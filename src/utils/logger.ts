
import winston from "winston";
import expressWinston from "express-winston"

const logFormat = winston.format.printf(({timestamp, label, level, message}) => {
    if (typeof message == "object") {
        message = JSON.stringify(message, null);
    }
    return `${timestamp} | ${label} | ${level}: ${message}`
});

export const appLogger = winston.createLogger({
    level: "debug",
    transports: [
        new winston.transports.Console()
    ],
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.timestamp(),
        winston.format.label({label: "App"}),
        logFormat,
    )
})

export const databaseLogger = winston.createLogger({
    level: "info",
    transports: [
        new winston.transports.Console()
    ],
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.timestamp(),
        winston.format.label({label: "Database"}),
        logFormat,
    )
})

export const routeLogger = expressWinston.logger({
    winstonInstance: appLogger,
    msg: `{{req.method}} {{req.path}} {{res.statusCode}} {{res.responseTime}}ms [{{req.ip}}]`,
});