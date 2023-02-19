import { Association, BelongsToGetAssociationMixin, CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize, UUIDV4 } from "sequelize";
import { UUID } from "../common/types";
import { registerAssociations, registerModel } from "../sequelize";
import { Product, PRODUCT_FK } from "./productModel";

export class Tag extends Model<InferAttributes<Tag>, InferCreationAttributes<Tag>> {
    declare productId: CreationOpt