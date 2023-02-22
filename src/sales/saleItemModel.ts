
import { Association, BelongsToGetAssociationMixin, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize } from "sequelize";
import { UUID } from "../common/types";
import { Product } from "../products/productModel";
import { Stock } from "../products/stockModel";
import { registerAssociations, registerModel } from "../sequelize";
import { Sale } from "./saleModel";

export class SaleItem extends Model<InferAttributes<SaleItem>, InferCreationAttributes<SaleItem>> {
    declare saleId: ForeignKey<UUID>;
    declare productId: ForeignKey<UUID>;
    declare quantity: number;
    declare price: number;
    declare total: number;

    declare getSale: BelongsToGetAssociationMixin<Sale>;
    declare getProduct: BelongsToGetAssociationMixin<Product>;

    // Eager loaded properties
    declare sale?: NonAttribute<Sale>;
    declare product?: NonAttribute<Product>;
    declare stock?: NonAttribute<Stock>;

    declare static associations: {
        sale: Association<SaleItem, Sale>,
        product: Association<SaleItem, Product>,
        stock: Association<SaleItem, Stock>,
    }
}

registerModel(initSaleItemModel);
registerAssociations(initSaleItemAssociations);

async function initSaleItemModel(sequelize: Sequelize): Promise<void> {
    SaleItem.init(
        {
            saleId: {
                type: DataTypes.UUID,
                primaryKey: true,
            },
            productId: {
                type: DataTypes.UUID,
                primaryKey: true,
            },
            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: {
                    min: 1,
                }
            },
            // Price in euro cents.
            price: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: {
                    min: 0,
                }
            },
            // Total in euro cents.
            total: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: {
                    min: 0,
                }
            }
        },
        {
            sequelize: sequelize,
            tableName: "sale_item",
            timestamps: false,
        }
    )
}

async function initSaleItemAssociations(): Promise<void> {
    SaleItem.belongsTo(Sale, {as: "sale", foreignKey: "saleId"});
    
    Product.hasMany(SaleItem, {foreignKey: "productId"});
    SaleItem.belongsTo(Product, {as: "product", foreignKey: "productId"});

    // Sequelize weirdness. We need this association to be able to query a joined table with Stock.
    // The "foreignKeyConstraint: false" won't add the FK constraint 
    // and "foreignKey: productId" won't create an addional column.
    SaleItem.belongsTo(Stock, {as: "stock", foreignKey: "productId"});
}