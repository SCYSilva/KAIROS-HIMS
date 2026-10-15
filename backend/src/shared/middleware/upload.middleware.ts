import multer from "multer";
import path from "path";
import fs from "fs";
import { AppError } from "../utils/AppError";

const uploadDir = path.resolve("uploads/evidence");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const uniqueName =
            Date.now() + "-" + file.originalname;

        cb(null, uniqueName);
    }
});


const fileFilter = (
    req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) => {

    const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "application/pdf"
    ];

    const allowedExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".pdf"
    ];

    const ext = path.extname(file.originalname).toLowerCase();

    if (
        allowedMimeTypes.includes(file.mimetype) &&
        allowedExtensions.includes(ext)
    ) {
        cb(null, true);
    } else {
        cb(
            new AppError(
                "Unsupported file type. Only JPG, PNG and PDF files are allowed.",
                400
            )
        );
    }
};


const upload = multer({

    storage,

    fileFilter,

    limits: {
        fileSize: 5 * 1024 * 1024
    }

});


export default upload;