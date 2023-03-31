
import winston from "winston";
import expressWinston from "express-winston"

const logFormat = winston.format.printf(({timestamp, label, level, message}) => {
    if (typeof message == "object") {
        message = JSON.stringify(message, null);
    }