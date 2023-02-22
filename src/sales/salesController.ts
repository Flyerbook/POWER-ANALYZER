
import { Body, Controller, Get, Path, Post, Query, Request, Response, Route, Security, SuccessResponse, Tags } from "tsoa";
import { Role } from "../common/roles";
import { AuthRequest, SecurityScheme } from "../security/authorization";
import { SaleItem } from "./saleItemModel";
import { Sale, SaleStatus } from "./saleModel";
import { UUID } from "../common/types";
import { Stock } from "../products/stockModel";
import { InferAttributes, Op, Transaction } from "sequelize";
import { BadRequestError, ConflitError, AppErrorCode, BadRequestErrorResponse, AuthenticationErrorResponse, ForbiddenErrorResponse, ServerErrorResponse, ConflitErrorResponse, AppError, NotFoundError } from "../common/errors";
import { User } from "../users/userModel";

const DEFAULT_START_DATE: Date = new Date(2022, 1, 1);
const DEFAULT_END_DATE: Date = new Date(2023, 1, 1);

const TAG_SALES = "Sales";

@Route("sales")
export class SaleController extends Controller {
    /**
     * The returned sales list will be ordered by date (asceding).
     * Each item in the list will contain the entire sale info.
     * If a search criteria is applied, only sales with an **exact** match will be returned.
     * 
     * @summary Get a list of sales. You may specify search parameters.
     * 
     * @param limit Limit the number of sales returned. Minimum 1.
     * @isInt limit Must be an integer >= 1.
     * @minimum limit 1 minimum 1.
     * 
     * @param page Used for pagination. When limit is used,
     * chunks of sales will be skipped (e.g. if page=5 and limit=10, the first 50 sales will be skipped).
     * @isInt page Must be an integer >= 0.
     * @minimum page 0 minimum 0.
     * 
     * @param startDate Sales after this date (inclusive). Use UTC format, time is optional.
     * @isDate startDate Must be a date like 'YYYY-MM-DD'.
     * 
     * @param endDate Sales before this date (inclusive). Use UTC format, time is optional.
     * @isDate endDate Must be a date like 'YYYY-MM-DD'.
     * 
     * @param sellerId Sales by this seller.
     * 
     * @param productId Sales with this product.
     * 
     * @param locationId Sales at this location.
     */
    @Get()
    @Tags(TAG_SALES)
    @Security(SecurityScheme.JWT, [Role.MANAGER])
    @SuccessResponse(200, "Successfully returned a list of sales.")
    @Response<BadRequestErrorResponse>(400, "Bad Request", {
        status: 400,
        error: {
            fields: {
                limit: {
                    message: "minimum 1",
                    value: "0"
                }
            }
        }
    })
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async getSales(
        @Query() limit: number = 10,
        @Query() page: number = 0,
        @Query() startDate: Date = DEFAULT_START_DATE,
        @Query() endDate: Date = DEFAULT_END_DATE,
        @Query() productId?: UUID,
        @Query() sellerId?: UUID,
        @Query() locationId?: UUID
    ): Promise<SearchSalesResult> {
        // Sanity check. Don't allow startDate to be greater than endDate
        if (startDate > endDate) {
            return Promise.reject(new BadRequestError({
                message: "Bad dates.",
                code: AppErrorCode.REQ_FORMAT,
                fields: {
                    "startDate": {
                        message: "startDate can't be greater than endDate",
                        value: startDate
                    },
                    "endDate": {
                        message: "endDate can't be less than startDate",
                        value: endDate
                    }
                }
            }));
        }

        // Find sales
        const result = await Sale.findAll({
            limit: limit, 
            offset: page * limit, 
            where: {
                updatedAt: {
                    [Op.gte]: startDate,
                    [Op.lte]: endDate
                },
                ...(sellerId) ? {sellerId: sellerId} : {},
                ...(locationId) ? {locationId: locationId} : {}
            }, 
            include: [
                {
                    association: Sale.associations.seller,
                    attributes: ["name"],
                },
                {
                    association: Sale.associations.items,
                    attributes: ["productId", "quantity", "price", "total"]
                },
                {
                    association: Sale.associations.items2,
                    attributes: [],
                    where: {
                        ...(productId) ? {productId: productId} : {}
                    },
                },
            ],
            order: [["updatedAt", "asc"]],
        });

        const sales = result.map(toSaleInfo);

        return {
            status: 200,
            data: sales
        };
    }

    /**
     * @summary Retrieve a sale's information.
     * 
     *  @param saleId The sale's unique identifier.
     */
    @Get("{saleId}")
    @Tags(TAG_SALES)
    @Security(SecurityScheme.JWT, [Role.SELLER])
    @SuccessResponse(200, "Successfully returned the sale info.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async getSaleInfo(
        @Path() saleId: UUID,
    ): Promise<GetSalesInfoResult> {
        // Find sales
        const result = await Sale.findByPk(saleId, {
            include: [
                {
                    association: Sale.associations.items,
                    attributes: ["productId", "quantity", "price", "total"],
                },
                {
                    association: Sale.associations.seller,
                    attributes: ["name"],
                },
            ],
        });

        if (result == null) {
            return Promise.reject(new NotFoundError({
                code: AppErrorCode.NOT_FOUND,
                message: "Sale not found"
            }));
        }
        console.log(result);
        return {
            status: 200,
            data: toSaleInfo(result)
        };
    }

    /** 
     * Creates a sale with the "Completed" status.
     * 
     * @summary Create a new sale.
     */
     @Post()
     @Tags(TAG_SALES)
     @Security(SecurityScheme.JWT, [Role.SELLER])
     @SuccessResponse(201, "Successfully created a new sale.")
     @Response<BadRequestErrorResponse>(400, "Bad Request")
     @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
     @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
     @Response<ConflitErrorResponse>(409, "Can't create sale.")
     @Response<ServerErrorResponse>(500, "Internal Server Error.")
     public async createSale(
        @Request() request: AuthRequest,
        @Body() body: CreateSaleParams,
     ): Promise<CreateSaleResult> {
        const { list, locationId } = body;
        const productIds: UUID[] = list.map(item => item.productId);
        const sellerId: UUID = request.auth.userId;

        // Sanity check. Don't allow duplicate values
        if (productIds.some((id, idx) => productIds.lastIndexOf(id) != idx)) {
            return Promise.reject(new BadRequestError({
                code: AppErrorCode.REQ_FORMAT,
                message: "Repeated productId not allowed."
            }));
        }
        
        // Begin a Repeatable Read transaction. Big wall of business logic incoming!
        const result = await Stock.sequelize!!.transaction(
            {isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ},
            async(transaction) => {
                // Find all products on the list and at this location.
                const stockResult: Stock[] = await Stock.findAll({
                    raw: true,
                    nest: true,
                    where: { productId: productIds, locationId: locationId },
                    include: {
                        attributes: ["price"],
                        association: Stock.associations.product
                    },
                    transaction,
                });

                // Verify if every product exists and has enough quantity in stock.
                const valid: boolean = list.every(item => {
                    const stock = stockResult.find(p => p.productId == item.productId);
                    return (stock != null && stock.quantity >= item.quantity);
                });
            
                // Stock invalid. End transaction.
                if (!valid) {
                    return new ConflitError({
                        message: "Can't create sale. Missing stock."
                    });
                }

                // Get seller info
                const seller = await User.findByPk(sellerId, {attributes: ["name"], transaction});
                if (seller == null) {
                    return new AppError({
                        code: AppErrorCode.NOT_FOUND,
                        message: "User not found.",
                        fields: {
                            "sellerId": {
                                message: "sellerId doesn't exist.",
                                value: sellerId
                            }
                        }
                    })
                };

                // Create the list of products.
                const items: InferAttributes<SaleItem>[] = list.map(item => {
                    const stock: Stock = stockResult.find(p => p.productId == item.productId)!!;
                    const price: number = stock.product!!.price;

                    // Update stock here and update it all at once.
                    stock.quantity -= item.quantity;
                    
                    return {
                        saleId: "",                     // Must be updated later or the insert will fail!
                        productId: item.productId,
                        quantity: item.quantity,
                        price: price,
                        total: item.quantity * price
                    }
                });

                // Create a new sale.
                const totalPrice: number = items.reduce((acc, item) => acc + item.total, 0);
                const sale: Sale = await Sale.create(
                    {
                        status: SaleStatus.COMPLETED,
                        sellerId: sellerId,
                        locationId: locationId,
                        totalPrice: totalPrice,
                    },
                    { transaction }
                );

                // Update saleId and save the list
                const saleId = sale.saleId;
                items.forEach(item => item.saleId = saleId);
                const saleItems = await SaleItem.bulkCreate(items, {transaction});

                // Update stock
                await Stock.bulkCreate(stockResult, {transaction, updateOnDuplicate: ["quantity"]});
                
                // Append associations
                sale.items = saleItems;
                sale.seller = seller;
                return sale;
            }
        );

        // Bubble up the error
        if (result instanceof AppError) {
            return Promise.reject(result);
        }

        return {
            status: 201,
            data: toSaleInfo(result)
        };
    }
}

// ------------------------------ Helper Functions ------------------------------ // 

/**
 * Takes a Sale object and formats it to a SaleInfo object.
 * 
 * @param sale The Sale object.
 * @returns The sale formatted as a SaleInfo object.
 */
function toSaleInfo(sale: Sale): SaleInfo {
    const items: SaleItemInfo[] = sale.items?.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
    })) || [];

    return {
        saleId: sale.saleId,
        customerId: sale.customerId,
        sellerId: sale.sellerId,
        sellerName: sale.seller!!.name,
        locationId: sale.locationId,
        status: sale.status,
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt,
        totalPrice: sale.totalPrice,
        items: items,
    }
}

// ------------------------------ Request Formats ------------------------------ //

interface CreateSaleListItem {
    productId: UUID,
    /** @isInt @minimum 1 minimum 1. */
    quantity: number,
}

/** JSON request format for the "POST /sales" endpoint. */
interface CreateSaleParams {
    locationId: UUID,
    list: CreateSaleListItem[]
}

// ------------------------------ Response Formats ------------------------------ //

interface SaleItemInfo {
    productId: UUID,
    quantity: number,
    price: number,
    total: number,
}

interface SaleInfo {
    saleId: UUID,
    customerId: UUID,
    sellerId: UUID,
    sellerName: string,
    locationId: UUID,
    status: SaleStatus,
    createdAt: Date,
    updatedAt: Date,
    totalPrice: number,
    items: SaleItemInfo[],
}

/** JSON response format for the "GET /sales" endpoint. */
export interface SearchSalesResult {
    status: 200,
    data: SaleInfo[]
}

/** JSON response format for the "GET /sales" endpoint. */
export interface GetSalesInfoResult {
    status: 200,
    data: SaleInfo
}

/** JSON response format for the "POST /sales" endpoint. */
export interface CreateSaleResult {
    status: 201,
    data: SaleInfo
}