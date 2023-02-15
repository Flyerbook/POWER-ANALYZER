
import { Body, Controller, Get, Patch, Path, Post, Put, Query, Response, Route, Security, SuccessResponse, Tags } from "tsoa";
import { SequelizeTransactionCallback, UUID } from "../common/types";
import { Role } from "../common/roles";
import { SecurityScheme } from "../security/authorization";
import { BagColour, TshirtColour, TshirtSize } from "./types";
import { Product } from "./productModel";
import { ForeignKeyConstraintError, Includeable, InferCreationAttributes, Op, Order, OrderItem, Sequelize, Transaction, WhereOptions } from "sequelize";
import { BadRequestError, ConflitError, AppErrorCode, NotFoundError, AppError, BadRequestErrorResponse, ServerErrorResponse, NotFoundErrorResponse, AuthenticationErrorResponse, ForbiddenErrorResponse, ConflitErrorResponse } from "../common/errors";
import { Price, ProductCategory } from "./types";
import { Stock } from "./stockModel";
import { Image } from "./imageModel";
import { Tag } from "./tagModel";
import { generateS3SignedUrl, ImageFileType } from "./ImageService";

// ------------------------------ Types ------------------------------ //

// Stock below or equal to this value is considered "LAST"
const STOCK_THRESHOLD = 3;

// The possible product's Status
enum ProductStatus {
    STOCK = "in stock",
    LAST = "last units",
    SOLD_OUT = "sold out",
    NO_INFO = "no info",
}

// To order products. The values themselves are just for documentation.
enum ProductOrder {
    PRICE_ASC = "product.price.asc",
    PRICE_DSC = "product.price.desc",
    NAME_ASC = "product.name.asc",
    NAME_DSC = "product.name.desc",
}

// Maps a ProductOrder into a Sequelize OrderItem
const ProductOrderMapper = {
    [ProductOrder.PRICE_ASC]: ["price", "asc"] as OrderItem,
    [ProductOrder.PRICE_DSC]: ["price", "desc"] as OrderItem,
    [ProductOrder.NAME_ASC]: ["name", "asc"] as OrderItem,
    [ProductOrder.NAME_DSC]: ["name", "desc"] as OrderItem,
}

const TAG_PRODUCTS = "Products";

@Route("products")
export class ProductsController extends Controller {
    /**
     * If a search criteria is applied, only products with an **exact** match will be returned.
     * When applicable, if a search parameter has multiple values, returned products will match at least one of those values.
     * 
     * @summary Retrieve a list of products. You may specify a search criteria.
     * 
     * @param limit Limit the number of products returned.
     * @isInt limit Must be an integer >= 1.
     * @minimum limit 1 minimum 1.
     * 
     * @param page Used for pagination. When limit is used,
     * chunks of products will be skipped (e.g. if page=5 and limit=10, the first 50 products will be skipped).
     * @isInt page Must be an integer >= 0.
     * @minimum page 0 minimum 0.
     * 
     * @param priceMin Minimum product price, in Euro cents, inclusive (minimum 0).
     * 
     * @param priceMax Maximum product price, in Euro cents, inclusive (maximum 200000).
     * 
     * @param stock Filter by product's availability. If true, only returns products with available stock.
     * 
     * @param category Filter by the product's category.
     * 
     * @param order How to order the results. 
     */
    @Get()
    @Tags(TAG_PRODUCTS)
    @SuccessResponse(200, "Successfully returned a list of products.")
    @Response<BadRequestErrorResponse>(400, "Bad Request.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async getProducts(
        @Query() limit: number = 10,
        @Query() page: number = 0,
        @Query() priceMin: Price = 0,
        @Query() priceMax: Price = 200000,
        @Query() stock: boolean = false,
        @Query() category?: ProductCategory,
        @Query() order?: ProductOrder,
    ): Promise<GetProductsResult> {
        // Where filter
        const where: WhereOptions = {
            price: {
                [Op.gte]: priceMin,
                [Op.lte]: priceMax
            }
        }

        // If the request wants products in stock, minimum stock is 1. 
        const minStock = (stock) ? 1 : 0;
        const include: Includeable[] = [
            {
                required: stock,
                association: Product.associations.stock,
                attributes: ["quantity"],
                where: {
                    quantity: {
                        [Op.gte]: minStock
                    }
                }
            },
            {
                required: false,
                association: Product.associations.image,
                attributes: ["data", "url"]
            },
            {
                required: false,
                association: Product.associations.tags,
                attributes: ["name", "value"]
            }
        ];

        // Category special case
        if (category != null) {
            where.category = category
        }

        // Order by
        const orderBy: Order = [];
        if (order != null) {
            orderBy.push(ProductOrderMapper[order as keyof typeof ProductOrderMapper]);
        }

        // Fetch products
        const result = await Product.findAll({limit: limit, offset: page * limit, where, include, order: orderBy});
        const products: ProductPublicInfo[] = result.map(product => toProductPublicInfo(product));
        
        return {
            status: 200,
            data: products
        }
    }

    /**
     * Retrieves the publicly available information of a product.
     * 
     * @summary Retrieve a product's public information.
     * 
     * @param productId The products's unique identifier.
     */
    @Get("{productId}")
    @Tags(TAG_PRODUCTS)
    @SuccessResponse(200, "Successfully returned the product's public information.")
    @Response<BadRequestErrorResponse>(400, "Invalid product identifier.")
    @Response<NotFoundErrorResponse>(404, "Product not found.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async getProductPublicInfo(
        @Path() productId: UUID,
    ) : Promise<GetProductPublicInfoResult> {
        
        // Fetch the product and its tags
        const result = await transactionRepeatableRead(async(t) => await getProductByPk(productId, t));
        
        // Product not found
        if (result == null) return Promise.reject(new NotFoundError());

        const publicInfo: ProductPublicInfo = toProductPublicInfo(result);

        return {
            status: 200,
            data: publicInfo
        }
    }

    /**
     * Retrieves the protected information of a product and its list of locations (stock).
     * Each location in this list has its unique identifier and its address.
     * 
     * @summary Retrieve a product's protected information.
     * 
     * @param productId The products's unique identifier.
     */
    @Get("{productId}/protected")
    @Tags(TAG_PRODUCTS)
    @Security(SecurityScheme.JWT, [Role.SELLER])
    @SuccessResponse(200, "Successfully returned the product's protected information.")
    @Response<BadRequestErrorResponse>(400, "Invalid product identifier.")
    @Response<NotFoundErrorResponse>(404, "Product not found.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async getProductProtectedInfo(
        @Path() productId: UUID,
    ) : Promise<GetProductProtectedInfoResult> {
        
        // Fetch the product and its tags
        const result = await transactionRepeatableRead(async(t) => await getProductByPk(productId, t));
        
        // Product not found
        if (result == null) return Promise.reject(new NotFoundError());

        const protectedInfo: ProductProtectedInfo = toProductProtectedInfo(result);

        return {
            status: 200,
            data: protectedInfo
        }
    }

    /**
     * @summary Creates a new Product.
     */
    @Post()
    @Tags(TAG_PRODUCTS)
    @Security(SecurityScheme.JWT, [Role.MANAGER])
    @SuccessResponse(201, "Successfully created a new product.")
    @Response<BadRequestErrorResponse>(400, "Bad Request.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ConflitErrorResponse>(409, "Can't create tshirt.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async createProduct(
        @Body() body: CreateProductParams
    ) : Promise<CreateProductResult> {
        if (!body.category) {
            return Promise.reject(new BadRequestError({
                code: AppErrorCode.REQ_FORMAT,
                message: "Expected product category.",
                fields: {
                    "body.category": {
                        message: `category is required and must be one of the following: [${Object.values(ProductCategory)}]`,
                        value: null
                    }
                }
            }))
        }

        const result = await createProduct(body);
        
        // Bubble up the error
        if (result instanceof AppError) {
            return Promise.reject(result);
        }
        
        return {
            status: 201,
            data: result.productId,
        }
    }

    /**
     * @summary Creates a new Tshirt.
     */
    @Post("tshirts")
    @Tags(TAG_PRODUCTS)
    @Security(SecurityScheme.JWT, [Role.MANAGER])
    @SuccessResponse(201, "Successfully created a new Tshirt.")
    @Response<BadRequestErrorResponse>(400, "Bad Request.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ConflitErrorResponse>(409, "Can't create tshirt.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async createTshirt(
        @Body() body: CreateTshirtParams
    ) : Promise<CreateProductResult> {
        body.category ??= ProductCategory.TSHIRT;
        return this.createProduct(body);
    }

    /**
     * @summary Creates a new Bag.
     */
    @Post("bags")
    @Tags(TAG_PRODUCTS)
    @Security(SecurityScheme.JWT, [Role.MANAGER])
    @SuccessResponse(201, "Successfully created a new Bag.")
    @Response<BadRequestErrorResponse>(400, "Bad Request.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ConflitErrorResponse>(409, "Can't create bag.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async createBag(
        @Body() body: CreateBagParams
    ) : Promise<CreateProductResult> {
        body.category ??= ProductCategory.BAG;
        return this.createProduct(body);
    }

    /**
     * @summary Creates a new Book.
     */
    @Post("books")
    @Tags(TAG_PRODUCTS)
    @Security(SecurityScheme.JWT, [Role.MANAGER])
    @SuccessResponse(201, "Successfully created a new Book.")
    @Response<BadRequestErrorResponse>(400, "Bad Request.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ConflitErrorResponse>(409, "Can't create book.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async createBook(
        @Body() body: CreateBookParams
    ) : Promise<CreateProductResult> {
        body.category ??= ProductCategory.BOOK;
        return this.createProduct(body);
    }

    /**
     * Update a products information, except its tags and category.
     * Returns the updated product.
     * 
     * @summary Update a product's protected information.
     * 
     * @param productId The product's unique identifier.
     */
    @Patch("{productId}/protected")
    @Tags(TAG_PRODUCTS)
    @Security(SecurityScheme.JWT, [Role.MANAGER])
    @SuccessResponse(200, "Successfully updated the product.")
    @Response<BadRequestErrorResponse>(400, "Bad Request.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async updateProduct(
        @Path() productId: UUID,
        @Body() body: UpdateProductParams
    ) : Promise<UpdateProductResult> {
        const { name, price, description } = body;

        const result = await transactionRepeatableRead(async (t) => {
            const result = await getProductByPk(productId, t);
            if (result == null) {
                return new NotFoundError({
                    code: AppErrorCode.NOT_FOUND,
                    message: "Product not found"
                });
            }

            const product = result;
            product.set({name, price, description});
            await product.save({transaction: t});
            return product;
        });

        // Product not found
        if (result instanceof AppError) {
            return Promise.reject(result);
        }

        const protectedInfo = toProductProtectedInfo(result);

        return {
            status: 200,
            data: protectedInfo
        }
    }

    /**
     * Updates the stock of a product at multiple locations.
     * Existing stock in other locations won't be modified unless part of the update.
     * 
     * @summary Update the stock of a product.
     * 
     * @param productId The product's unique identifier.
     */
    @Patch("{productId}/stock")
    @Tags(TAG_PRODUCTS)
    @Security(SecurityScheme.JWT, [Role.MANAGER])
    @SuccessResponse(204, "Successfully updated stock.")
    @Response<BadRequestErrorResponse>(400, "Bad Request.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<NotFoundError>(404, "Product not found.")
    @Response<ConflitErrorResponse>(409, "Can't update stock.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async updateProductstock(
        @Path() productId: UUID,
        @Body() body: UpdateProductStockParams
    ) : Promise<void> {
        const { list } = body;
        const locations = list.map(item => item.locationId);

        // Sanity check. Don't allow repeated locationIds.
        if (locations.some((id, idx) => locations.lastIndexOf(id) != idx)) {
            return Promise.reject(new BadRequestError({
                code: AppErrorCode.REQ_FORMAT,
                message: "Repeated locationId not allowed."
            }));
        }

        const toUpsert: InferCreationAttributes<Stock>[] = list.map<InferCreationAttributes<Stock>>(stock => ({
            productId: productId,
            locationId: stock.locationId,
            quantity: stock.quantity
        }));

        try {
            const result = await Product.sequelize!!.transaction(
                {isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ},
                async(t) => {
                    const product = await Product.findByPk(productId, {transaction: t});

                    // Product not found
                    if (product == null) {
                        return new NotFoundError({
                            code: AppErrorCode.NOT_FOUND,
                            message: "Product not found.",
                            fields: {
                                "productId": {
                                    message: "This productId doesn't exist.",
                                    value: productId
                                }
                            }
                        });
                    }

                    await Stock.bulkCreate(toUpsert, {updateOnDuplicate: ["quantity"], transaction: t});
                }
            );

            // Reject errors
            if (result instanceof AppError) {
                return Promise.reject(result);
            }

        } catch (err) {
            // Error during upsert
            if (err instanceof ForeignKeyConstraintError) {
                return Promise.reject(new ConflitError({
                    message: "Can't update product's stock. Some locations don't exist."
                }));
            }
            throw err;
        }
    }

    /**
     * Associates this product's image to an URL. You may upload the image file to the returned URL. 
     * 
     * @summary Retrieve the product's image URL.
     * 
     * @param productId The product's unique identifier.
     */
    @Get("{productId}/image/url")
    @Tags(TAG_PRODUCTS)
    @Security(SecurityScheme.JWT, [Role.MANAGER])
    @SuccessResponse(200, "Successfully updated the image.")
    @Response<BadRequestErrorResponse>(400, "Bad Request.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<NotFoundError>(404, "Product not found.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async getImageSignedUrl(
        @Path() productId: UUID,
        @Query() fileType: ImageFileType,
    ) : Promise<GetImageSignedUrlResponse> {
        const result = await generateS3SignedUrl(productId, fileType);
        
        try {
            await Image.upsert({productId: productId, url: result.url});
            return {
                status: 200,
                data: result
            }

        } catch(err) {
            // Product not found
            if (err instanceof ForeignKeyConstraintError) {
                return Promise.reject(new NotFoundError({
                    code: AppErrorCode.NOT_FOUND,
                    message: "Product not found.",
                    fields: {
                        "productId": {
                            message: "productId doesn't exist.",
                            value: productId
                        }
                    }
                }));
            }

            throw err;
        }
    }

    /**
     * Updates the image of a product. If an image already exist, it will be replaced.
     * 
     * @summary Update the image of a product.
     * 
     * @param productId The product's unique identifier.
     */
    @Put("{productId}/image")
    @Tags(TAG_PRODUCTS)
    @Security(SecurityScheme.JWT, [Role.MANAGER])
    @SuccessResponse(204, "Successfully updated the image.")
    @Response<BadRequestErrorResponse>(400, "Bad Request.")
    @Response<AuthenticationErrorResponse>(401, "Not Authenticated.")
    @Response<ForbiddenErrorResponse>(403, "Not Authorized.")
    @Response<NotFoundError>(404, "Product not found.")
    @Response<ServerErrorResponse>(500, "Internal Server Error.")
    public async updateProductImage(
        @Path() productId: UUID,
        @Body() body: UpdateProductImage
    ) : Promise<void> {
        const { image } = body;

        try {
            await Image.upsert({productId: productId, data: image});
        } catch(err) {
            // Product not found
            if (err instanceof ForeignKeyConstraintError) {
                return Promise.reject(new NotFoundError({
                    code: AppErrorCode.NOT_FOUND,
                    message: "Product not found.",
                    fields: {
                        "productId": {
                            message: "productId doesn't exist.",
                            value: productId
                        }
                    }
                }));
            }

            throw err;
        }
    }
}

// ------------------------------ Helper Functions ------------------------------ //
/**
 * Starts a transaction with the "Repeatable Read" isolation level.
 * 
 * @param callback Callback for the transaction.
 * @returns A promise to be either resolved with the transaction result or rejected with an Error.
 */
async function transactionRepeatableRead<T>(callback: SequelizeTransactionCallback<T>): Promise<T> {
    return Product.sequelize!!.transaction({isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ}, callback);
}

/**
 * Starts a transaction with the "Read Committed" isolation level.
 * 
 * @param callback Callback for the transaction.
 * @returns A promise to be either resolved with the transaction result or rejected with an Error.
 */
 async function transactionReadCommitted<T>(callback: SequelizeTransactionCallback<T>): Promise<T> {
    return Product.sequelize!!.transaction({isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED}, callback);
}

/**
 * Receives a Product's primary key and fetches that product from the database, alongside its stock and category tags.
 * 
 * @param productId The product's primary key.
 * @param transaction The trasanction
 * @returns A promise to be either resolved with the Product and its Tags or reject with an Error.
 */
async function getProductByPk(productId: Product["productId"], transaction?: Transaction): Promise<Product | null> {
    const include: Includeable[] = [
        {
            required: false,
            association: Product.associations.stock,
            attributes: ["locationId", "quantity"]
        },
        {
            required: false,
            association: Product.associations.image,
            attributes: ["data", "url"],
        },
        {
            required: false,
            association: Product.associations.tags,
            attributes: ["name", "value"]
        }
    ];

    return await Product.findByPk(productId, {include, transaction});
}

/**
 * Receives a product and transforms it into a view with protected info.
 * 
 * @param product The product to be processed.
 * @returns A product formatted with protected info.
 */
 function toProductProtectedInfo(product: Product): ProductProtectedInfo {
    const tags = product.tags?.reduce((acc: any, tag) => {
        acc[tag.name] = tag.value;
        return acc;
    }, {});

    const stock = product.stock?.map(s => ({locationId: s.locationId, quantity: s.quantity}));
    const totalStock = stock?.reduce((acc, entry) => acc + entry.quantity, 0);
    const status: ProductStatus = (stock?.length == 0) ? 
        ProductStatus.NO_INFO : (totalStock!! == 0) ? 
        ProductStatus.SOLD_OUT : (totalStock!! <= STOCK_THRESHOLD) ? 
        ProductStatus.LAST : ProductStatus.STOCK;
    
    // Make formatted product
    const protectedInfo: ProductProtectedInfo = {
        productId: product.productId,
        name: product.name,
        description: product.description,
        price: product.price,
        status: status,
        image: product.image?.data,
        url: product.image?.url,
        category: product.category,
        tags: tags,
        stock: stock || [],
        totalStock: totalStock || 0,
    }

    return protectedInfo;
}

/**
 * Receives a product and transforms it into a view with only public info.
 * 
 * @param product The product to be processed.
 * @returns A product formatted with public info.
 */
function toProductPublicInfo(product: Product): ProductPublicInfo {
    const protectedInfo: ProductProtectedInfo = toProductProtectedInfo(product);
    const publicInfo: ProductPublicInfo = {
        productId: protectedInfo.productId,
        name: protectedInfo.name,
        description: protectedInfo.description,
        price: protectedInfo.price,
        status: protectedInfo.status,
        image: protectedInfo.image,
        url: protectedInfo.url,
        category: protectedInfo.category,
        tags: protectedInfo.tags,
    }

    return publicInfo;
}

interface ProductTag {
    productId: string,
    name: string,
    value: string,
}

/**
 * Creates a new product.
 * 
 * @param params Product creation parameters.
 * @param _category The product's category.
 * @returns A promise to be either resolved with the created product or an AppError or rejected with an Error.
 */
async function createProduct(params: CreateProductParams): Promise<Product | AppError> {
    const { name, description, price, category, ...tags } = params;
    const tagNames: string[] = Object.keys(tags);
    const tagValues: string[] = Object.values(tags);

    return await transactionReadCommitted(async(t) => {
        const count = await Tag.count({
            attributes: [
                [Sequelize.literal("DISTINCT(COUNT(*))"), "count"]
            ],
            where: {
                [Op.or]: tagNames.map((name, idx) => ({name: name, value: tagValues[idx]}))
            },
            include: {
                association: Tag.associations.product,
                attributes: [],
                where: {
                    category: category
                }
            },
            group: "Tag.productId",
            transaction: t,
        });
        
        // Check if tag combination already exists
        if (count.some(result => result.count == tagNames.length)) {
            return new ConflitError({
                code: AppErrorCode.DUPLICATED,
                message: "This product's tags already exist.",
                fields: tagNames.reduce((acc: any, name, idx) => {
                    acc[name] = {
                        message: "Repeated tag combination.",
                        value: tagValues[idx]
                    }
                    return acc;
                }, {})
            });
        }

        const product = await Product.create({name, description, price, category: category!!}, {transaction: t});
        const productId = product.productId;

        // Associate product's tags
        const pTags: ProductTag[] = tagNames.map((name, idx) => ({
            productId,
            name,
            value: tagValues[idx]
        }));
        await Tag.bulkCreate(pTags, {transaction: t});
        return product; 
    })
}

// ------------------------------ Request Formats ------------------------------ //

interface CreateProductBaseParams {
    name: string,
    description: string,
    price: Price,
    category?: ProductCategory,
}

interface CreateTshirtParams extends CreateProductBaseParams {
    category?: ProductCategory.TSHIRT,
    colour: TshirtColour,
    size: TshirtSize,
    design: string,
}

interface CreateBagParams extends CreateProductBaseParams {
    category?: ProductCategory.BAG,
    colour: BagColour,
    design: string,
}

interface CreateBookParams extends CreateProductBaseParams {
    category?: ProductCategory.BOOK,
    title: string,
    author: string,
    publisher: string,
    year: string,
}

// Product creation parameters must match one of these.
// To add a new Product category, just update this definition. Follow the scheme above.
type CreateProductParams = CreateTshirtParams | CreateBagParams | CreateBookParams;

interface UpdateProductParams {
    name?: string,
    description?: string,
    price?: Price,
}

interface ProductStock {
    locationId: UUID,
    quantity: number,
}

interface UpdateProductStockParams {
    list: ProductStock[]
}

interface UpdateProductImage {
    image: string
}

// ------------------------------ Response Formats ------------------------------ //

// TSOA doesn't like "object", so this is a workaround.
interface ProductCategoryTags {
    [name: string]: string
}

interface ProductStockInfo {
    locationId: UUID,
    quantity: number,
}

interface ProductProtectedInfo {
    productId: UUID,
    name: string,
    description: string,
    price: number,
    status: ProductStatus,
    image?: string,
    url?: string,
    category: ProductCategory,
    tags: ProductCategoryTags,
    stock: ProductStockInfo[],
    totalStock: number,
}

// Public info is the same as protected info, except a few properties.
type ProductPublicInfo = Omit<ProductProtectedInfo, "stock" | "totalStock">

/** JSON response format for the "GET /products" endpoint. */
interface GetProductsResult {
    status: 200,
    data: ProductPublicInfo[]
}

/** JSON response format for the "GET /products/{productId}" endpoint. */
interface GetProductPublicInfoResult {
    status: 200,
    data: ProductPublicInfo
}

/** JSON response format for the "GET /products/{productId}/protected" endpoint. */
interface GetProductProtectedInfoResult {
    status: 200,
    data: ProductProtectedInfo
}

/** JSON response format for the "POST /products/{category}" endpoint. */
interface CreateProductResult {
    status: 201,
    data: UUID,
}

/** JSON response format for the "PATCH /products/{productId}" endpoint. */
interface UpdateProductResult {
    status: 200,
    data: ProductProtectedInfo
}

interface GetImageSignedUrlResponse {
    status: 200,
    data: {
        url: string,
        signed: string,
    }
}