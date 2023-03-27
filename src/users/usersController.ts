
import { Body, Controller, Get, Patch, Path, Post, Query, Request, Response, Route, Security, SuccessResponse, Tags } from "tsoa";
import { Fullname, Password, Username, UUID } from "../common/types";
import { AuthRequest, SecurityScheme } from "../security/authorization";
import { User } from "./userModel";
import { UniqueConstraintError } from "sequelize";
import { AppError, AppErrorCode, AuthenticationErrorResponse, BadRequestErrorResponse, ConflitError, ConflitErrorResponse, ForbiddenErrorResponse, NotFoundError, NotFoundErrorResponse, ServerErrorResponse } from "../common/errors";
import { hasRolePrivileges, Role } from "../common/roles";
import { hashData } from "../utils/crypto";

const TAG_USERS = "Users";

@Route("users")
export class UsersController extends Controller {
    /**
     * Retrieve a list of user accounts. 
     * If a search criteria is applied, only users with an **exact** match will be returned.
     * 
     * @summary Retrieve a list of users. You may specify search parameters.
     * 
     * @param role Filter users by role.
     */
    @Get()
    @Tags(TAG_USERS)
    @Security(SecurityScheme.JWT, [Role.ADMIN])
    @SuccessResponse(200, "Successfully returned a list of users.")
    @Response<BadRequestErrorResponse>(400, "Bad Request", {
        status: 400,
        error: {
            fields: {
                role: {
                    message: "should be one of the following; [...]",
                    value: "abc"
                }
            }
        }
    })
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async searchUsers(
        @Query() role?: Role,
    ): Promise<SearchUsersResult> {
        const where = (role == undefined) ? {} : {role: role};
        const attributes = ["userId", "name", "role", "createdAt", "updatedAt"];
        
        const result = await User.findAll({ where, attributes });
        const userList: UserFullInfo[] = result.map(toUserFullInfo);

        return {
            status: 200,
            data: userList
        };
    }

    /**
     * Only retrieves users with the role 'seller'.
     * 
     * @summary Retrieve a list of users with the 'seller' role. You may specify search parameters.
     */
    @Get("sellers")
    @Tags(TAG_USERS)
    @Security(SecurityScheme.JWT, [Role.MANAGER])
    @SuccessResponse(200, "Successfully returned a list of users with the 'seller' role.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async getSellers(
    ): Promise<GetSellersResult> {
        const where = {role: Role.SELLER};
        const attributes = ["userId", "name"];
        const result = await User.findAll({ where, attributes });
        const sellerList: UserProfile[] = result.map(toUserProfile);

        return {
            status: 200,
            data: sellerList
        };
    }

    /**
     * @summary Create a user.
     */
    @Post()
    @Tags(TAG_USERS)
    @SuccessResponse(201, "Successfully created a user.")
    @Response(400, "Bad Request")
    @Response<ConflitErrorResponse>(409, "Can't create user.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async createUser(
        @Body() body: CreateUserParams,
    ): Promise<CreateUserResult> {
        const { username, password, name } = body;
        const hashedPw = await hashData(password);

        try {
            const result = await User.create({username, password: hashedPw, name, role: Role.BASIC})
            return {
                status: 201, 
                data: result.userId,
            }
        } catch(error: any) {
            if (error instanceof UniqueConstraintError) {
                return Promise.reject(new ConflitError({
                    code: AppErrorCode.DUPLICATED,
                    message: "User already exists.", 
                    fields: {
                    "body.username": {
                        message: "Duplicated username.",
                        value: username,
                    }
                }}));
            }

            return Promise.reject(error);
        }
    }

    /**
     * Only the own user, or an account with sufficient privileges, may view this profile.
     * 
     * @summary Retrieve the user profile.
     * @param userId User's unique identifier.
     */
    @Get("{userId}")
    @Tags(TAG_USERS)
    @Security(SecurityScheme.JWT, [Role.BASIC])
    @SuccessResponse(201, "Successfully returned the user's profile.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<NotFoundErrorResponse>(404, "User not found.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async getUserProfile(
        @Request() request: AuthRequest,
        @Path() userId: UUID,
    ): Promise<GetUserProfileResult> {
        const notFoundError = new NotFoundError({
            code: AppErrorCode.NOT_FOUND,
            message: "User not found.",
            fields: {
                "userId": {
                    message: "This userId doesn't exist.",
                    value: userId
                }
            }
        });

        // Check if the request has sufficient privileges to view this user profile.
        if (request.auth.userId !== userId && !hasRolePrivileges(request.auth.role, Role.SELLER)) {
            return Promise.reject(notFoundError);
        }
        
        const attributes = ["userId", "name"];
        const result = await User.findByPk(userId, {attributes});

        if (result == null) {
            return Promise.reject(notFoundError);
        }

        return {
            status: 200,
            data: toUserProfile(result)
        }
    }

    /**
     * Only the own user, or an account with sufficient privileges, may edit this profile.
     * 
     * @summary Update user profile.
     * 
     * @param userId User's unique identifier.
     */
    @Patch("{userId}")
    @Tags(TAG_USERS)
    @Security(SecurityScheme.JWT, [Role.BASIC])
    @SuccessResponse(200, "Successfully updated the user's profile.")
    @Response<BadRequestErrorResponse>(400, "Bad Request", {
        status: 400,
        error: {
            fields: {
                "body.name": {
                    message: "invalid string value",
                    value: 0
                }
            }
        }
    })
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async updatehUserProfile(
        @Request() request: AuthRequest,
        @Path() userId: UUID,
        @Body() body: UpdateUserProfileParams,
    ): Promise<UpdateUserProfileResult> {
        const notFoundError = new NotFoundError({
            code: AppErrorCode.NOT_FOUND,
            message: "User not found.",
            fields: {
                "userId": {
                    message: "This userId doesn't exist.",
                    value: userId
                }
            }
        });

        // Check if the request has sufficient privileges to edit this user profile.
        if (request.auth.userId !== userId && !hasRolePrivileges(request.auth.role, Role.ADMIN)) {
            return Promise.reject(notFoundError);
        }

        const { name } = body;
        const attributes = ["userId", "name"];

        try {
            const result = await User.sequelize!!.transaction(async (transaction) => {
                const user = await User.findByPk(userId, {attributes, transaction});
                if (user == null) {
                    return notFoundError;
                }
                user.name = name;
                await user.save({transaction});

                return user
            });

            // User not found
            if (result instanceof AppError) {
                return Promise.reject(result);
            }

            return {
                status: 200,
                data: toUserProfile(result)
            }

        } catch (error) {
            return Promise.reject(error);
        }
    }

    /**
     * @summary Retrieve the user's information.
     * @param userId User's unique identifier.
     */
    @Get("{userId}/fullinfo")
    @Tags(TAG_USERS)
    @Security(SecurityScheme.JWT, [Role.ADMIN])
    @SuccessResponse(200, "Successfully returned the user's information.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<NotFoundErrorResponse>(404, "User not found.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async getUserFullInfo(
        @Path() userId: UUID,
    ): Promise<GetUserFullInfoResult> {
        const attributes = ["userId", "name", "role", "createdAt", "updatedAt"];
        const result = await User.findByPk(userId, {attributes});

        // User not found
        if (result == null) {
            return Promise.reject(new NotFoundError({
                code: AppErrorCode.NOT_FOUND,
                message: "User not found.",
                fields: {
                    "userId": {
                        message: "This userId doesn't exist.",