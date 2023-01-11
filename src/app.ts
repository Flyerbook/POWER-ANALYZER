import express, { Express, Request, Response } from "express";
import swaggerUI from "swagger-ui-express";
import cookieParser from "cookie-parser";
import { server as config } from "./config.json";
import cors from "cors";

// Single express instace
export const app: Express = express();

// OpenAPI specification
import API_SPECIFICATION from "./swagger.json";
const API_PATH = "/v1";
API_SPECIFICATION.servers[0].url = API_PATH;

// CORS with specific request origins and cookie credentials
const origins = process.env.ORIGINS?.split(",") || config.ORIGINS;
app.use(cors({
    origin: origins,
    credentials: true
}));

// Cookie parser middleware
app.use(cookieParser());

// JSON middleware
app.use(express.json());

// URL encoded middleware
app.use(express.urlencoded({extended: true}));

// Redirect HTTP requests.
// If behind a trusted proxy, the request headers "x-forwarded" will be trusted.
const TRUST_PROXY: boolean = config.trustProxy;
if (TRUST_PROXY) {
    app.enable("trust proxy");
    app.use("*", (request: Request, response: Response, next: Function) => {
        if (request.headers["x-forwarded-proto"] === "http") {
            response.redirect(`https://${request.get("host")}${request.originalUrl}`);
        } else {
            next();
        }
    });
}

// Winston logger
import { routeLogger } from "./utils/logger";
app.use(