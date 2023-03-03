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
 * Receives a Sequelize instance to initialize the Model.
 * @param seq The Sequelize instance.
 * @returns A promise to be either resolved after the Model is initialized or rejected with an Error.
 */
 type ModelInit = (seq: Sequelize) => Promise<void>;
 const models: ModelInit[] = [];
 const associations: AssociationsInit[] = [];

/**
 * Models defined elsewhere call this method to sync with the database during initialization. 
 * 
 * @param init Function that takes a sequelize instance and initializes the Model.
 */
export function registerModel(init: ModelInit) {
    models.push(init);
}

/**
 * Model associations defined elsewhere call this method to sync with the database during initialization.
 * 
 * @param init Function that initializes the Model's associations.
 */
export function register