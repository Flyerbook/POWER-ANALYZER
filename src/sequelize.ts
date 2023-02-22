import { Options, Sequelize } from "sequelize";
import { sequelize as config } from "./config.json";
import { databaseLogger } from "./utils/logger";

// Database URL and options
const URL: string = process.env.DATABASE_URL || config.DATABASE_URL;
const options: Options = config.options;

/**
 * Initializes the Model's associations.
 */
type AssociationsInit = () => Promise<void>

/**
 * Receives a Sequelize instance to initi