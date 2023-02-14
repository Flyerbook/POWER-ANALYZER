import { Association, BelongsToGetAssociationMixin, CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize, UUIDV4 } from "sequelize";
import { UUID } from "../common/types";
import { registerAssociations, registerModel } from "../sequelize";
import { Product, PRODUCT_FK } from "./productModel";

export class Image extends Model<InferAttributes<Image>, InferCreationAttributes<Image>> {
    declare productId: CreationOptional<UUID>;
    declare data: CreationOptional<string>;
    declare url: CreationOptional<string>;

    /** Retrieve the associated Product. */
    declare getProduct: BelongsToGetAssociationMixin<Product>;

    // Eager loaded properties.
    declare product?: NonAttribute<Product>;

    declare static associations: {
        product: Association<Image, Product>;
    }
}

registerModel(initImageModel);
registerAssociations(initImageAssociations);

async function initImageModel(sequelize: Sequelize): Promise<void> {
    Image.init(
        {
            productId: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: UUIDV4,
                validate: {
                    isUUID: 4
                }
            },
            data: {
                type: DataTypes.TEXT,
                allowNull: true,
                validate: {
                    notEmpty: true
                },
            },
            url: {
                type: DataTypes.TEXT,
                allowNull: true,
                validate: {
                    isUrl: true,
                }
            }
        },
        {
            sequelize: sequelize,
            tableName: "image",
            timestamps: false,
        }
    )
}

async function initImageAssociations(): Promise<void> {
    Image.belongsTo(Product, {
        foreignKey: PRODUCT_FK,
        as: "product"
    });
}