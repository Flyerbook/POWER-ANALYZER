
import { Body, Controller, Post, Request, Response, Route, SuccessResponse, Tags } from "tsoa";
import * as jwt from "jsonwebtoken";
import { security as config } from "../config.json";
import { User } from "../users/userModel";
import { Fullname, Password, Username, UUID } from "../common/types";
import { Request as ExpressRequest, Response as ExpressResponse } from "express";
import { Role } from "../common/roles";
import { Transaction } from "sequelize";
import { getNowAfterSeconds, hasDateExpired, randomToken, validateData } from "../utils/crypto";
import { AuthenticationError, AppErrorCode, ForbiddenError, NotFoundError, NotFoundErrorResponse, AuthenticationErrorResponse, ForbiddenErrorResponse, BadRequestError, AppError } from "../common/errors";
import { OAuth2Client } from "google-auth-library";
import { appLogger } from "../utils/logger";

// Access token info. As the name implies, this token grants access to the application resources.
const accessSecret: string = process.env.ACCESS_SECRET || config.ACCESS_SECRET;
const accessCookie: string = config.accessCookie;
const accessExpires: number = config.accessExpiresInSeconds;

// Refresh token info. This token is used to refresh the access token.
const refreshCookie: string = config.refreshCookie;
const refreshExpires: number = config.refreshExpiresInSeconds;

// Google ID client
const GOOGLE_ID: string = process.env.GOOGLE_ID || config.GOOGLE_ID;
const googleClient = new OAuth2Client(GOOGLE_ID);

/**
 * The JSON Web Token format for the application access token.
 * 
 * @param userId User's unique identifier.
 * @param role User's role in the system.
 * @param locationId The Location associated to the user.  
 */
 export interface JwtAccessFormat {
    userId: UUID,
    role: Role,
    name: Fullname,
    locationId?: UUID,
}

const TAG_AUTH = "Auth";
@Route("auth")
export class AuthController extends Controller {
    /**
     * Login with an user account to access protected resources.
     * A pair of JSON Web Tokens will be set as cookies for application access and authentication.
     * 
     * @summary Login an user account.
     */
    @Post("login")
    @Tags(TAG_AUTH)
    @SuccessResponse(200, "Login successfull.")
    @Response<NotFoundErrorResponse>(404, "User Not Found.")
    public async loginBasic(
        @Request() request: ExpressRequest,
        @Body() body: LoginBasicParams,
    ): Promise<LoginResult> {
        const { username, password } = body;
        
        // Using a Repeateable Read transaction because we want to ensure the user info doesn't change.
        const result = await User.sequelize!!.transaction(
            {isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ},
            async (t) => {
                const user = await User.findOne({where: {username: username}, transaction: t});
                
                // Check if user exists and password matches
                if (user == null || !(await validateData(password, user.password || ""))) {
                    return new NotFoundError({
                        code: AppErrorCode.NOT_FOUND,
                        message: "User not found",
                    });
                }

                // Create refresh token and expiration Date and save it
                const refreshToken = await randomToken();
                const expiresDate: Date = getNowAfterSeconds(refreshExpires);
                user.token = refreshToken;
                user.tokenExpiresDate = expiresDate;
                await user.save({transaction: t});

                return user;
            }
        );
        
        // User not found or password mismatch. However, we don't want to inform which (extra security).
        if (result instanceof AppError) {
            return Promise.reject(result);
        }
        
        const token = await makePayloadAndSetCookies(request, result);
        return {
            status: 200,
            data: token
        }
    }

    /**
     * Login with a Google ID.
     * A pair of JSON Web Tokens will be set as cookies for application access and authentication.
     * The request must follow the authentication flow defined by 
     * [Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
     * 
     * @summary Login an user account.
     */
    @Post("login/google")
    @Tags(TAG_AUTH)
    @SuccessResponse(200, "Login successfull.")
    public async loginGoogle(
        @Request() request: ExpressRequest,
        @Body() body: LoginGoogleParams,
    ): Promise<LoginResult> {
        // Verify Google ID
        const credential = body.credential;
        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: GOOGLE_ID,
            });
            payload = ticket.getPayload();
        } catch (err) {
            appLogger.error(err);
            return Promise.reject(new ForbiddenError());
        }
        
        // User data
        const email = payload?.email!!;
        const name = payload?.name!!;

        // Using a Repeateable Read transaction because we want to ensure the user info doesn't change.
        const user = await User.sequelize!!.transaction(
            {isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ},
            async (t) => {
                let user = await User.findOne({where: {email: email}, transaction: t});

                // User not found, create a new account.
                if (user == null) {
                    user = await User.create({email: email, name: name, role: Role.BASIC}, {transaction: t});
                }

                // Create refresh token and expiration Date and save it
                const refreshToken = await randomToken();
                const expiresDate: Date = getNowAfterSeconds(refreshExpires);
                user.token = refreshToken;
                user.tokenExpiresDate = expiresDate;
                await user.save({transaction: t});

                return user;
            }
        );
        
        const token = await makePayloadAndSetCookies(request, user);
        return {
            status: 200,
            data: token
        }
    }

    /**
     * The server will clear the authentication tokens.
     * 
     * @summary Logout the current user account.
     */
    @Post("logout")
    @Tags(TAG_AUTH)
    @SuccessResponse(204, "Logout successfull.")
    public async logout(
        @Request() request: ExpressRequest
    ): Promise<void> {
        const accessToken: string = request.cookies[accessCookie];

        try {
            const payload: any = await verifyToken(accessToken, accessSecret, {ignoreExpiration: true});
            const { userId } = payload; 
            await User.sequelize!!.transaction(
                {isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ},
                async (t) => {
                    const user = await User.findOne({where: {userId: userId}, transaction: t});
    
                    // This token is invalid, so nothing to do. 
                    if (user == null) {
                        return;
                    }
    
                    // Remove token information
                    user.token = null;
                    user.tokenExpiresDate = null;
                    await user.save({transaction: t});
                }
            )
        } catch(err) {
            // We really don't care about sending errors here, since we're trying to logout the user.
            // Even if there was a DB error, it doesn't matter to the user.
            appLogger.error(err);
        }
        
        // Clear cookies.
        const response = request.res;
        response?.clearCookie(accessCookie, {path: "/", secure: true, httpOnly: true, sameSite: "none"});
        response?.clearCookie(refreshCookie, {path: "/", secure: true, httpOnly: true, sameSite: "none"});
    }

    /**
     * When receiving a valid refresh token, generates a new access token and extends the duration
     * of the refresh token.
     * If either token is invalid, or if the refresh token has expired, the server won't refresh the tokens.
     * 
     * @summary Refresh authentication tokens.
     */
    @Post("refresh")
    @Tags(TAG_AUTH)
    @SuccessResponse(204, "Refresh successfull.")
    @Response<AuthenticationErrorResponse>(401, "Missing Authentication tokens.")
    @Response<ForbiddenErrorResponse>(403, "Request refused. Invalid tokens.")
    public async refresh(
        @Request() request: ExpressRequest,
    ): Promise<void> {
        const accessToken: string = request.cookies[accessCookie];
        const refreshToken: string = request.cookies[refreshCookie];
        
        // Both tokens must exist
        if (accessToken == null || refreshToken == null) {
            return Promise.reject(new AuthenticationError({
                message: "Missing authentication token.",
                code: AppErrorCode.TOKEN_MISSING
            }));
        }

        // Verify if access token is valid
        let payload: any;
        try {
            payload = await verifyToken(accessToken, accessSecret, {ignoreExpiration: true});
        } catch (error) {
            return Promise.reject(new ForbiddenError({message: "Invalid access token.", code: AppErrorCode.TOKEN_INVALID}));
        }

        const result = await User.sequelize!!.transaction(
            {isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ},
            async (t) => {
                const userId = (payload as JwtAccessFormat).userId;
                const user = await User.findOne({where: {userId: userId, token: refreshToken}, transaction: t});

                // Check if user exists with that token and if the token is still valid
                if (user == null || hasDateExpired(user.tokenExpiresDate)) {
                    return new ForbiddenError({
                        message: "Invalid authentication tokens.",
                        code: AppErrorCode.TOKEN_INVALID
                    });
                }

                // Create new refresh token (token rotation)
                const newRefreshToken = await randomToken();
                const expiresDate: Date = getNowAfterSeconds(refreshExpires);
                user.token = newRefreshToken;
                user.tokenExpiresDate = expiresDate;
                await user.save({transaction: t});

                return user;
            }
        );

        // Refresh tokens has expired or is invalid
        if (result instanceof AppError) {
            return Promise.reject(result);
        }

        await makePayloadAndSetCookies(request, result);
    }
}

// ------------------------------ Helper Functions ------------------------------ //

/**
 * Creates the access token and sets the respective cookies. 
 * 
 * @param request The Express Request object.
 * @param user The user account.
 * @returns A promise to be either resolved with the access token payload or rejected with an Error.
 */
async function makePayloadAndSetCookies(request: ExpressRequest, user: User): Promise<JwtAccessFormat> {
    // TSOA doesn't have an injectable Response object.
    // We can circumvent this by using Express.Request to access the associated Response object.
    const response = request.res as ExpressResponse;
    
    // Generate new tokens and set cookies
    const accessPayload: JwtAccessFormat = {
        userId: user.userId,
        name: user.name,
        role: user.role
    };
    
    // Allow the access token to exist for as long as the refresh token does.
    const maxAge = refreshExpires * 1000;
    const accessToken = await signPayload(accessPayload, accessSecret, {expiresIn: accessExpires});
    response.cookie(accessCookie, accessToken, {path: "/", secure: true, httpOnly: true, sameSite: "none", maxAge});
    response.cookie(refreshCookie, user.token, {path: "/", secure: true, httpOnly: true, sameSite: "none", maxAge});

    return accessPayload;
}

/**
 * jsonwebtoken.sign() only works with a callback.
 * This function acts as an adapter.
 * 
 * @param payload The data to be encoded.
 * @param secret The secret key.
 * @param options JWT Encoding options.
 */
async function signPayload(
    payload: string | Object | Buffer,
    secret: jwt.Secret,
    options: jwt.SignOptions
): Promise<string> {
    return new Promise((resolve, reject) => {
        jwt.sign(payload, secret, options, function(err: any, encoded: any) {
            if (err) {
                reject(err);
            } else {
                resolve(encoded);
            }
        })
    })
}

/**
 * jsonwebtoken.verify() only works with a callback.
 * This function acts as an adapter.
 * 
 * @param token The encoded data.
 * @param secret The secret key.
 * @param options JWT Verify options.
 */
async function verifyToken(
    token: string,
    secret: jwt.Secret | jwt.GetPublicKeyOrSecret,
    options?: jwt.VerifyOptions
): Promise<jwt.Jwt | jwt.JwtPayload | string> {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secret, options, function(err: any, decoded: any) {
            if (err) {
                reject(err);
            } else {
                resolve(decoded);
            }
        })
    })
}

// ------------------------------ Request Formats ------------------------------ //

interface LoginBasicParams {
    username: Username,
    password: Password,
}

// Google ID credentials
interface LoginGoogleParams {
    credential: string,
}

// ------------------------------ Response Formats ------------------------------ //

interface LoginResult {
    status: 200,
    data: JwtAccessFormat
}