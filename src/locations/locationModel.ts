
import { Association, BelongsToManyAddAssociationMixin, BelongsToManyGetAssociationsMixin, CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize, UUIDV4 } from "sequelize";
import { UUID } from "../common/types";
import { Product } from "../products/productModel";
import { STOCK_LOCATION_FK, STOCK_PRODUCT_FK, Stock } from "../products/stockModel";
import { registerAssociations, registerModel } from "../sequelize";

registerModel(initLocationModel);
registerAssociations(initLocationAssociations);

export class Location extends Model<InferAttributes<Location>, InferCreationAttributes<Location>> {
    declare locationId: CreationOptional<UUID>;
    declare address: string;

    declare getProducts: BelongsToManyGetAssociationsMixin<Product>;
    declare addProduct: BelongsToManyAddAssociationMixin<Product, Product["productId"]>;

    // Eager loaded properties
    declare products?: NonAttribute<Product[]>;
    declare stock?: NonAttribute<Stock[]>;

    declare static associations: {
        products: Association<Location, Product>,
        stock: Association<Location, Stock>
    }
}

async function initLocationModel(sequelize: Sequelize): Promise<void> {
    Location.init(
        {
            locationId: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: UUIDV4,
                validate:{
                    isUUID: 4
                }
            },
            address: {
                type: DataTypes.STRING,
                unique: true,
                allowNull: false
            },
        },
        {
            sequelize: sequelize,
            tableName: "location",
            timestamps: false,
        }
    )
}

async function initLocationAssociations(): Promise<void> {
    Location.belongsToMany(Product, {
        through: Stock,
        as: "products",
        foreignKey: STOCK_LOCATION_FK,
        otherKey: STOCK_PRODUCT_FK
    });

    Location.hasMany(Stock, {
        as: "stock",
        foreignKey: STOCK_LOCATION_FK
    });
}