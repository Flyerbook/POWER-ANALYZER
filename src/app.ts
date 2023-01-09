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

// Cookie parse