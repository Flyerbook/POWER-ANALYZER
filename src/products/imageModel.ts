import { Association, BelongsToGetAssociationMixin, CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize, UUIDV4 } from "sequelize";
import { UUID } from "../common/types";
import { registerAssociations, registerModel } from "../sequelize";
import { Product, PRODUCT_FK } from "./productModel";

export class Image extends Model<InferAttributes<Image>, InferCreationAttributes<Image>> {
    declare productId: CreationOptional<UUID>;
    declare data: CreationOptional<string>;
    declare url: CreationOptional<string>;

    /** Retrieve the associated Product. */
  