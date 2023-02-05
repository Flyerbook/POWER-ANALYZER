
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
    @Security(SecurityScheme.JWT, [Role.MANAGER])
    @SuccessResponse(201, "Successfully created a location.")
    @Response<BadRequestErrorResponse>(400, "Bad Request", {
        status: 400,
        error: {
            fields: {
                "body.address": {
                    message: "invalid string value",
                    value: 1
                }
            }
        }
    })
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ConflitErrorResponse>(409, "Can't create location.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async createLocation(
        @Body() body: CreateLocationParams,
    ): Promise<CreateLocationResult> {
        const { address } = body;
        
        try {
            const location = await Location.create({address});
            return {
                status: 201,
                data: location.locationId
            }

        } catch (err) {
            // Duplicate location
            if (err instanceof UniqueConstraintError) {
                return Promise.reject(new ConflitError({
                    message: "Can't create location.",
                    code: AppErrorCode.DUPLICATED,
                    fields: {
                        "body.address": {
                            message: "Address not unique.",
                            value: address,
                        }
                    }
                }))
            }
            throw err;
        }
    }

    /**
     * Returns the location information and its list of products (stock).
     * Each product in this list has its unique identifier, name, price, category and quantity at the location.
     * 
     * @summary Retrieve the location info and its list of products.
     */
    @Get("{locationId}")
    @Tags(TAG_LOCATIONS)
    @Security(SecurityScheme.JWT, [Role.SELLER])
    @SuccessResponse(200, "Successfully the location info.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ForbiddenErrorResponse>(404, "Location not found.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async getLocationById(
        @Path() locationId: UUID
    ): Promise<GetLocationByIdResult> {
        
        const result = await Location.findByPk(locationId, {
            include: {
                association: Location.associations.stock,
                attributes: ["productId", "quantity"],
                include: [
                    {
                        required: true,
                        association: Stock.associations.product,
                        attributes: ["productId", "name", "price", "category"],
                    }
                ]
            },
        });
        
        // Location not found
        if (result == null) {
            return Promise.reject(new NotFoundError());
        }

        const locationInfo: LocationWithStock = toLocationWithStock(result);

        return {
            status: 200,
            data: locationInfo
        };
    }

    /**
     * Updates the stock of a location with multiple products.
     * Existing stock of other prodcuts won't be modified unless part of the update.
     * 
     * @summary Update the stock at a location.
     * 
     * @param locationId The location's unique identifier.
     */
    @Patch("{locationId}/stock")
    @Tags(TAG_LOCATIONS)
    @Security(SecurityScheme.JWT, [Role.MANAGER])
    @SuccessResponse(204, "Successfully updated stock.")
    @Response<BadRequestErrorResponse>(400, "Bad Request.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<NotFoundError>(404, "Location not found.")
    @Response<ConflitErrorResponse>(409, "Can't update stock.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async updateLocationStock(
        @Path() locationId: UUID,
        @Body() body: UpdateLocationStockParams
    ) : Promise<void> {
        const { list } = body;
        const productIds = list.map(item => item.productId);

        // Sanity check. Don't allow repeated productId.
        if (productIds.some((id, idx) => productIds.lastIndexOf(id) != idx)) {
            return Promise.reject(new BadRequestError({
                code: AppErrorCode.REQ_FORMAT,
                message: "Repeated productId not allowed."
            }));
        }

        const toUpsert: InferCreationAttributes<Stock>[] = list.map<InferCreationAttributes<Stock>>(stock => ({
            locationId: locationId,
            productId: stock.productId,
            quantity: stock.quantity
        }));

        try {
            const result = await Location.sequelize!!.transaction(
                {isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ},
                async(t) => {
                    const location = await Location.findByPk(locationId, {transaction: t});

                    // Location doesn't exist
                    if (location == null) {
                        return new NotFoundError({
                            message: "Location doesn't exist.",
                            code: AppErrorCode.NOT_FOUND,
                            fields: {
                                "locationId": {
                                    message: "This locationId doesn't exist.",
                                    value: locationId
                                }
                            }
                        });
                    }

                    await Stock.bulkCreate(toUpsert, {updateOnDuplicate: ["quantity"], transaction: t});
                }
            );

            // Location doesn't exist
            if (result instanceof AppError) {
                return Promise.reject(result);
            }

        } catch (err) {
            // Error during upsert
            if (err instanceof ForeignKeyConstraintError) {
                return Promise.reject(new ConflitError({
                    message: "Can't update location's stock. Some products don't exist."
                }));
            }
            throw err;
        }
    }
}

// ------------------------------ Helper Functions ------------------------------ //

/**
 * Takes a Location and formats it into a LocationInfo. 
 * 
 * @param location The Location to be formatted.
 * @returns The formatted Location.
 */
function toLocationInfo(location: Location): LocationInfo {
    return {
        locationId: location.locationId,
        address: location.address
    }
}

/**
 * Takes a Location and formats it into a LocationInfo. 
 * 
 * @param location The Location to be formatted.
 * @returns The formatted Location.
 */
 function toLocationWithStock(location: Location): LocationWithStock {
    const stock: ProductInfo[] = location.stock?.map(stock => {
        const product = stock.product!!;

        return {
            productId: product.productId,
            name: product.name,
            price: product.price,
            category: product.category,
            quantity: stock.quantity,
        }
    }) || [];

    return {
        locationId: location.locationId,
        address: location.address,
        stock: stock 
    }
}

// ------------------------------ Request Formats ------------------------------ //

/** JSON request format for the "POST /locations" endpoint. */
 interface CreateLocationParams {
    /** @example "Some address" */
    address: string
}

interface LocationStock {
    productId: UUID,
    quantity: number,
}

/** JSON request format for the "PATCH /locations/{locationId}/stock" endpoint. */
interface UpdateLocationStockParams {
    list: LocationStock[]
}

// ------------------------------ Response Formats ------------------------------ //

interface ProductInfo {
    productId: UUID,
    name: string,
    price: number,
    category: ProductCategory,
    quantity: number
}

interface LocationInfo {
    locationId: UUID,
    address: string,
}

interface LocationWithStock extends LocationInfo {
    stock: ProductInfo[]
}

/** JSON response format for the "GET /locations" endpoint. */
interface SearchLocationsResult {
    status: 200,
    data: LocationInfo[]
}

/** JSON response format for the "POST /locations" endpoint. */
interface CreateLocationResult {
    status: 201,
    data: UUID
}

/** JSON response format for the "GET /locations/{locationId}" endpoint. */
interface GetLocationByIdResult {
    status: 200,
    data: LocationWithStock
}