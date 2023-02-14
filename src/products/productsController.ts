
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