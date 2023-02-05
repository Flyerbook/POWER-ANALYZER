
import { ForeignKeyConstraintError, InferCreationAttributes, Transaction, UniqueConstraintError } from "sequelize";
import { Body, Controller, Get, Patch, Path, Post, Response, Route, Security, SuccessResponse, Tags } from "tsoa";
import { BadRequestError, ConflitError, AppErrorCode, NotFoundError, AppError, AuthenticationErrorResponse, ForbiddenErrorResponse, ServerErrorResponse, BadRequestErrorResponse, ConflitErrorResponse } from "../common/errors";
import { UUID } from "../common/types";
import { Role } from "../common/roles";
import { Stock } from "../products/stockModel";
import { Price, ProductCategory } from "../products/types";
import { SecurityScheme } from "../security/authorization";
import { Location } from "./locationModel";

const TAG_LOCATIONS = "Locations";

@Route("locations")
export class LocationsController extends Controller {
    /**
     * @summary Retrieve a list of locations.
     */
    @Get()
    @Tags(TAG_LOCATIONS)
    @Security(SecurityScheme.JWT, [Role.SELLER])
    @SuccessResponse(200, "Successfully returned a list of locations.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async getLocations(
    ): Promise<SearchLocationsResult> {
        const result: Location[] = await Location.findAll();
        const locations: LocationInfo[] = result.map(toLocationInfo);

        return {
            status: 200,
            data: locations
        };
    }

    /** 
     * Creates a Location and returns its unique identifier.
     * The location's address must be unique.
     * 
     * @summary Create a new location.
     */
    @Post()
    @Tags(TAG_LOCATIONS)