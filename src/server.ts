
import { app } from "./app";
import * as config from "./config.json";
import { initDatabase } from "./sequelize"
import { User } from "./users/userModel";

import path from "path";
import fs from "fs";
import http from "http";
import https from "https";
import { Role } from "./common/roles";
import { hashData } from "./utils/crypto";
import { appLogger } from "./utils/logger";

const PORT: number = Number(process.env.PORT) || config.server.PORT;
const USE_HTTPS: boolean = config.server.https;
const CERT_PATH: string = path.join(__dirname, ".", "sslcerts", "cert.pem");
const KEY_PATH: string = path.join(__dirname, ".", "sslcerts", "key.pem");
const PASSPHRASE: string = process.env.CERT_PASSPHRASE || config.server.CERT_PASSPHRASE;

// Workaround solution to enable the use of async/await.
// async/await can't be used at top-level without changing the configuration file
// which breaks the code in other places.
(async () => {
    appLogger.info("Starting...");
    
    // Start database
    await initDatabase();
    appLogger.info("Connected successfully to Database!");

    // Initial configuration admin configuration
    const user = await User.findOne({where: {role: Role.ADMIN}});
    if (user == null) {
        appLogger.warn("No admin account detected.");
        const username: string = process.env.ADMIN_USER || config.database.ADMIN_USER;
        const password: string = process.env.ADMIN_PW || config.database.ADMIN_PW;

        if (username == null || password == null || username.length == 0 || password.length == 0) {
            appLogger.warn(
                "No admin configuration. Restart with valid configuration or create one directly.\n" + 
                "Some resources will be unavailable without an admin account."
            );
        } else {
            const hashedPw: string = await hashData(password);
            await User.create({username, password: hashedPw, name: "ADMIN", role: Role.ADMIN});
            appLogger.info("Created default admin account.")
        }
    }
    // Start server
    if (USE_HTTPS) {
        const certificate = fs.readFileSync(CERT_PATH, "utf-8");
        const privateKey = fs.readFileSync(KEY_PATH, "utf-8");
        https.createServer(
            {
                cert: certificate,
                key: privateKey,
                passphrase: PASSPHRASE
            }
            , app).listen(PORT, () => { appLogger.info((`HTTPS Server started on port ${PORT}`)); })
    } else {
        http.createServer(app).listen(PORT, () => { appLogger.info((`HTTP Server started on port ${PORT}`)); });
    }
})().catch(appLogger.error);