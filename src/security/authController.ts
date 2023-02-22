
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