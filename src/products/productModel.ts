
import { Association, BelongsToManyAddAssociationMixin, BelongsToManyGetAssociationsMixin, CreationOptional, DataTypes, HasManyGetAssociationsMixin, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize, UUIDV4 } from "sequelize";
import { UUID } from "../common/types";
import { Location } from "../locations/locationModel";
import { registerAssociations, registerModel } from "../sequelize";
import { Image } from "./imageModel";
import { Stock, STOCK_LOCATION_FK, STOCK_PRODUCT_FK } from "./stockModel";
import { Tag } from "./tagModel";
import { ProductCategory} from "./types";

export const PRODUCT_FK = "productId"; 

export class Product extends Model<InferAttributes<Product>, InferCreationAttributes<Product>> {
    declare productId: CreationOptional<UUID>;
    declare name: string;
    declare description: string;
    declare price: number;
    declare category: ProductCategory;
    declare createdAt: NonAttribute<Date>;
    declare updatedAt: NonAttribute<Date>;

    /** Retrieve the product's locations. */
    declare getLocations: BelongsToManyGetAssociationsMixin<Location>;
    /** Associate this product to a location. */
    declare addLocation: BelongsToManyAddAssociationMixin<Location, Location["locationId"]>;
    /** Retrieve the product's stock */
    declare getStocks: HasManyGetAssociationsMixin<Stock>;
    /** Retrieve the product's tags */
    declare getTags: HasManyGetAssociationsMixin<Tag>;

    // Eager loaded properties.
    declare locations?: NonAttribute<Location[]>;
    declare stock?: NonAttribute<Stock[]>;
    declare image?: NonAttribute<Image>;
    declare tags?: NonAttribute<Tag[]>;

    declare static associations: {
        locations: Association<Product, Location>;
        stock: Association<Product, Stock>;
        image: Association<Product, Image>;
        tags: Association<Product, Tag>;
    }
}

registerModel(initProductModel);
registerAssociations(initProductAssociations);

async function initProductModel(sequelize: Sequelize): Promise<void> {
    Product.init(
        {
            productId: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: UUIDV4,
                validate: {
                    isUUID: 4
                }
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },
            description: {
                type: DataTypes.STRING,
                allowNull: false,
                validate: {
                    notEmpty: true,
                }
            },
            // Price in euro cents.
            price: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: {
                    min: 0
                }
            },
            category: {
                type: DataTypes.ENUM,
                allowNull: false,
                values: Object.values(ProductCategory)
            }
        },
        {
            sequelize: sequelize,
            tableName: "product",
            timestamps: true,
        }
    )
}

async function initProductAssociations(): Promise<void> {
    Product.belongsToMany(Location, {
        through: Stock, 
        foreignKey: STOCK_PRODUCT_FK,
        otherKey: STOCK_LOCATION_FK,
        as: "locations",
    })
    
    Product.hasMany(Stock, {
        foreignKey: STOCK_PRODUCT_FK,
        as: "stock",
    });

    Product.hasOne(Image, {
        foreignKey: PRODUCT_FK,
        as: "image"
    });

    Product.hasMany(Tag, {
        foreignKey: PRODUCT_FK,
        as: "tags"
    });
}