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
app.use(routeLogger);

// API Routes
import { RegisterRoutes } from "./routes";
const ROUTER = express.Router();
RegisterRoutes(ROUTER);
app.use(API_PATH, ROUTER);

// Documentation routes
const DOCS_PATH = "/docs";
app.get(`${DOCS_PATH}/swagger.json`, (request: Request, response: Response) => {
    response.status(200);
    response.json(API_SPECIFICATION);
    response.end();
});
app.use(`${DOCS_PATH}`, swaggerUI.serve, swaggerUI.setup(API_SPECIFICATION));

// Any other path is redirected back to docs
app.use("/", (request: Request, response: Response) => response.redirect(DOCS_PATH));

// Default Error Handler
import { requestErrorHandler } from "./common/errors";
app.use(requestErrorHandler);