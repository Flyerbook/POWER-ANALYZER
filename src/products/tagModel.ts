import { Association, BelongsToGetAssociationMixin, CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize, UUIDV4 } from "sequelize";
import { UUID } from "../common/types";
import { registerAssociations, registerModel } from "../sequelize";
import { Product, PRODUCT_FK } from "./productModel";

export class Tag extends Model<InferAttributes<Tag>, InferCreationAttributes<Tag>> {
    declare productId: CreationOptional<UUID>;
    declare name: string;
    declare value: string;

    /** Retrieve the associated Product. */
    declare getProduct: BelongsToGetAssociationMixin<Product>;

    // Eager loaded properties.
    declare product?: NonAttribute<Product>;

    declare static associations: {
        product: Association<Tag, Product>;
    }
}

registerModel(initTagModel);
registerAssociations(initTagAssociations);

async function initTagModel(sequelize: Sequelize): Promise<void> {
    Tag.init(
        {
            productId: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: UUIDV4,
                validate: {
                    isUUID: 4
                }
            },
      