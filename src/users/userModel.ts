import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize, UUIDV4 } from "sequelize";
import { Email, Password, Username } from "../common/types";
import { registerAssociations, registerModel } from "../sequelize";
import { Role } from "../common/roles";

registerModel(initUserModel);
registerAssociati