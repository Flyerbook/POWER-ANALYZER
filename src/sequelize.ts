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
export function registerAssociations(init: AssociationsInit) {
    associations.push(init);
}

/**
 * Initializes the DB connection.
 */
export async function initDatabase(): Promise<void> {
    databaseLogger.info("Initializing DB connection...");
    const sequelize = await createSequelizeInstace();

    try {
        await sequelize.authenticate();
    } catch (error) {
        return Promise.reject("Connection failed. Verify connection info ('DATABASE_URL' or 'config.json').");
    }
    
    databaseLogger.info("Authenticated.");

    await Promise.all(models.map(func => func(sequelize)));
    await Promise.all(associations.map(func => func()));
    await sequelize.sync();
}

/**
 * @returns A Sequelize instance.
 */
async function createSequelizeInstace(): Promise<Sequelize> {
    if (URL == null || URL == "") {
        return Promise.reject(
            "No connection configuration. "+
            "Set the 'DATABASE_URL' enviroment variable or use the 'config.json' file."
        )    
    }   
    return new Sequelize(URL, {
        ...options,
        logging: msg => databaseLogger.info(msg)
    });
}