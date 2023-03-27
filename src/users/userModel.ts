import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize, UUIDV4 } from "sequelize";
import { Email, Password, Username } from "../common/types";
import { registerAssociations, registerModel } from "../sequelize";
import { Role } from "../common/roles";

registerModel(initUserModel);
registerAssociations(initUserAssociations);

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    declare userId: CreationOptional<string>;
    declare username: Username | null;
    declare password: Password | null;
    declare name: string;
    declare email: Email | null;
    declare role: Role;
    declare createdAt: NonAttribute<Date>;
    declare updatedAt: NonAttribute<Date>;
    declare token: string | null;
    declare tokenExpiresDate: Date | null;
}

async function initUserModel(sequelize: Sequelize): Promise<void> {
    User.init(
        {
            userId: {
                type: DataTypes.UUID,
                primaryKey: true,
                defaultValue: UUIDV4,
                validate:{
                    isUUID: 4
                }
            },
            username: {
                type: DataTypes.STRING,
                unique: true,
                allowNull: true,
            },
            password: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            email: {
                type: DataTypes.STRING,
                unique: true,
                allowNull: true,
                validate: {
                    isEmail: true,
                }
            },
            role: {
                type: DataTypes.ENUM,
                allowNull: false,
                values: Object.values(Role)
            },
            token: {
                type: DataTypes.STRING,
                unique: true,
            },
            tokenExpiresDate: {
                type: DataTypes.DATE,
            }
        },
        {
            sequelize: sequelize,
            tableName: "user",
            timestamps: true,
        }
    )
}

async function initUserAssociations(): Promise<void> {
    ;
}