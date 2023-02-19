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
    declare getLocation: BelongsToGetAssociationMixin<Location>;

    // Eager loaded properties
    declare product?: NonAttribute<Product>;
    declare location?: NonAttribute<Location>;

    declare static associations: {
        product: Association<Stock, Product>,
        location: Association<Stock, Location> 
    }
}

registerModel(initStockModel);
registerAssociations(initStockAssociations);

async function initStockModel(sequelize: Sequelize): Promise<void> {
    Stock.init(
        {
            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: {
                    min: 0
                }
            }
        },
        {
            timestamps: false,
            sequelize: sequelize,
            tableName: "stock",
        }
    )
}

async function initStockAssociations(): Promise<void> {
    Stock.belongsTo(Product, {
        foreignKey: STOCK_PRODUCT_FK,
        as: "product"
    });

    Stock.belongsTo(Location, {
        foreignKey: STOCK_LOCATION_FK,
        as: "location"
    });
}