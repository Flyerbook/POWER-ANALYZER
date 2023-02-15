import { Association, BelongsToGetAssociationMixin, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize } from "sequelize";
import { Location } from "../locations/locationModel";
import { registerAssociations, registerModel } from "../sequelize";
import { Product } from "./productModel";

export const STOCK_PRODUCT_FK = "productId";
export const STOCK_LOCATION_FK = "locationId";

export class Stock extends Model<InferAttributes<Stock>, InferCreationAttributes<Stock>> {
    declare productId: ForeignKey<Product["productId"]>;
    declare locationId: ForeignKey<Location["locationId"]>;
    declare quantity: number;

    declare getProduct: BelongsToGetAssociationMixin<Product>;
   