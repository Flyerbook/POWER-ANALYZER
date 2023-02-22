
import { Association, BelongsToGetAssociationMixin, CreationOptional, DataTypes, HasManyGetAssociationsMixin, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize, UUIDV4 } from "sequelize";
import { UUID } from "../common/types";
import { Location } from "../locations/locationModel";
import { registerAssociations, registerModel } from "../sequelize";
import { User } from "../users/userModel";
import { SaleItem } from "./saleItemModel";

export enum SaleStatus {
    COMPLETED = "completed",
    PENDING = "pending",
    CANCELLED = "cancelled"
}

export class Sale extends Model<InferAttributes<Sale>, InferCreationAttributes<Sale>> {
    declare saleId: CreationOptional<UUID>;
    declare customerId: CreationOptional<UUID>;
    declare sellerId: CreationOptional<UUID>;
    declare locationId: CreationOptional<UUID>;
    declare status: SaleStatus;
    declare totalPrice: number;
    declare createdAt: CreationOptional<Date>;
    declare updatedAt: CreationOptional<Date>;

    declare getLocation: BelongsToGetAssociationMixin<Location>;
    
    declare getCustomer: BelongsToGetAssociationMixin<User>;

    declare getSeller: BelongsToGetAssociationMixin<User>;

    // Eager loaded properties
    declare items?: NonAttribute<SaleItem[]>;
    declare customer?: NonAttribute<User>;
    declare seller?: NonAttribute<User>;
    declare location?: NonAttribute<Location>;

    declare static associations: {
        items: Association<Sale, SaleItem>,
        items2: Association<Sale, SaleItem>,
        customer: Association<Sale, User>,
        seller: Association<Sale, User>,
        location: Association<Sale, Location>,
    }
}

registerModel(initSaleModel);
registerAssociations(initSaleAssociations);

async function initSaleModel(sequelize: Sequelize): Promise<void> {
    Sale.init(
        {
            saleId: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: UUIDV4,
                validate: {
                    isUUID: 4
                }
            },
            customerId: {
                type: DataTypes.UUID,
            },
            sellerId: {
                type: DataTypes.UUID,
            },
            locationId: {
                type: DataTypes.UUID,
            },
            status: {
                type: DataTypes.ENUM,
                allowNull: false,
                values: Object.values(SaleStatus)
            },
            // Price in euro cents.
            totalPrice: {
                type: DataTypes.BIGINT,
                allowNull: false,
                validate: {
                    min: 0
                }
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
            }
        },
        {
            sequelize: sequelize,
            tableName: "sale",
            timestamps: true,
        }
    )
}

async function initSaleAssociations(): Promise<void> {
    // Sequelize weirdness. If we want to join the same table N times, we need to add N associations.
    // The alternative is to make a raw query, but that is less generic and error prone. 
    Sale.hasMany(SaleItem, {as: "items", foreignKey: "saleId"});
    Sale.hasMany(SaleItem, {as: "items2", foreignKey: "saleId"});

    Sale.belongsTo(User, {as: "customer", foreignKey: "customerId"});
    Sale.belongsTo(User, {as: "seller", foreignKey: "sellerId"});
    Sale.belongsTo(Location, {as: "location", foreignKey: "locationId"});
    
    User.hasMany(Sale, {foreignKey: "customerId"});
    User.hasMany(Sale, {foreignKey: "sellerId"});
    Location.hasMany(Sale, {foreignKey: "locationId"});
}