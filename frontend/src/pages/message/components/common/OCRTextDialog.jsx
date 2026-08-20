import { useEffect, useRef, useState } from "react";
import Tesseract from "tesseract.js";

import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    CircularProgress,
    IconButton,
} from "@mui/material";

import {
    CloseRounded,
    ZoomInRounded,
    ImageRounded,
    UploadRounded,
} from "@mui/icons-material";


function isMeaningfulOCRText(text, confidence = 0) {
    const cleaned = text
        .replace(/\s+/g, " ")
        .trim();

    if (!cleaned) {
        return false;
    }

    // Tesseract confidence check
    if (confidence < 45) {
        return false;
    }

    const characters = cleaned.replace(/\s/g, "");

    if (characters.length < 3) {
        return false;
    }

    // Count readable letters and numbers
    const readableCharacters = characters.match(/[A-Za-z0-9]/g) || [];

    const readableRatio =
        readableCharacters.length / characters.length;

    // Reject OCR output containing too many symbols/garbage characters
    if (readableRatio < 0.55) {
        return false;
    }

    // Check whether there are meaningful words/numbers
    const words = cleaned
        .split(/\s+/)
        .filter((word) => /[A-Za-z0-9]{2,}/.test(word));

    // Either several readable words or a sufficiently long text
    if (words.length >= 2) {
        return true;
    }

    if (readableCharacters.length >= 6) {
        return true;
    }

    return false;
}


function OCRTextDialog({
    open,
    imageFile,
    imagePreviewUrl,
    onClose,
    onUseText,
    onSelectNewImage,
}) {

    const [extractedText, setExtractedText] = useState("");
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrProgress, setOcrProgress] = useState(0);
    const [ocrError, setOcrError] = useState("");
    const [noTextDetected, setNoTextDetected] = useState(false);

    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const fileInputRef = useRef(null);


    // ==========================================
    // RUN OCR WHEN DIALOG OPENS
    // ==========================================

    useEffect(() => {

        if (!open || !imageFile) {
            return;
        }

        let cancelled = false;


        const extractText = async () => {

            try {

                setOcrLoading(true);
                setOcrProgress(0);
                setOcrError("");
                setExtractedText("");
                setNoTextDetected(false);


                const result = await Tesseract.recognize(
                    imageFile,
                    "eng",
                    {
                        logger: (info) => {

                            if (
                                info.status ===
                                "recognizing text"
                            ) {

                                setOcrProgress(
                                    Math.round(
                                        (info.progress || 0) * 100
                                    )
                                );

                            }

                        },
                    }
                );


                if (!cancelled) {

    const text = result.data.text.trim();

    const confidence = result.data.confidence || 0;

    const hasMeaningfulText =
        isMeaningfulOCRText(
            text,
            confidence
        );

    if (hasMeaningfulText) {

        setExtractedText(text);
        setNoTextDetected(false);

    } else {

        setExtractedText("");
        setNoTextDetected(true);

    }

}

            } catch (error) {

                console.error(
                    "OCR failed:",
                    error
                );

                if (!cancelled) {

                    setOcrError(
                        "Unable to extract text from this image. Please try another image."
                    );

                }

            } finally {

                if (!cancelled) {

                    setOcrLoading(false);

                }

            }

        };


        extractText();


        return () => {

            cancelled = true;

        };

    }, [open, imageFile]);


// ==========================================
// SELECT ANOTHER IMAGE
// ==========================================

const handleSelectAnotherImage = () => {
    if (ocrLoading) {
        return;
    }

    fileInputRef.current?.click();
};

const handleNewImageSelected = (event) => {
    const newFile = event.target.files?.[0];

    if (!newFile) {
        return;
    }

    // Only allow image files
    if (!newFile.type.startsWith("image/")) {
        setOcrError(
            "Please select a valid image file."
        );
        return;
    }

    // Reset the input so the same file can be selected again
    event.target.value = "";

    // Tell the parent about the new image.
    // The parent should update imageFile and imagePreviewUrl,
    // which will automatically trigger OCR again.
    onSelectNewImage?.(newFile);
};


    // ==========================================
    // CLOSE
    // ==========================================

    const handleClose = () => {

        if (ocrLoading) {
            return;
        }

        setImageViewerOpen(false);

        onClose?.();

    };


    // ==========================================
    // USE OCR TEXT
    // ==========================================

    const handleUseText = () => {

        if (!extractedText.trim()) {
            return;
        }

        onUseText?.(
            extractedText.trim()
        );

    };


    return (
        <>  
            <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleNewImageSelected}
            />

            <Dialog
                open={open}
                onClose={handleClose}
                fullWidth
                maxWidth="lg"
            >

                {/* ==========================================
                    HEADER
                ========================================== */}

                <DialogTitle
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >

                    <div className="flex items-center gap-2">

                        <ImageRounded />

                        <span>
                            Extract Text from Image
                        </span>

                    </div>


                    <IconButton
                        onClick={handleClose}
                        disabled={ocrLoading}
                    >
                        <CloseRounded />
                    </IconButton>

                </DialogTitle>


                {/* ==========================================
                    CONTENT
                ========================================== */}

                <DialogContent dividers>

                    <div className="grid gap-6 md:grid-cols-2">


                        {/* ==================================
                            IMAGE
                        ================================== */}

                        <div>

                            <p className="mb-2 text-sm font-semibold text-foreground">
                                Uploaded Image
                            </p>


                            <div
                                className="
                                    relative
                                    flex
                                    min-h-[300px]
                                    cursor-pointer
                                    items-center
                                    justify-center
                                    overflow-hidden
                                    rounded-xl
                                    border
                                    border-border
                                    bg-muted/30
                                "
                                onClick={() =>
                                    imagePreviewUrl &&
                                    setImageViewerOpen(true)
                                }
                            >

                                {imagePreviewUrl ? (

                                    <img
                                        src={imagePreviewUrl}
                                        alt="Uploaded image for OCR"
                                        className="
                                            max-h-[420px]
                                            max-w-full
                                            object-contain
                                        "
                                    />

                                ) : (

                                    <p className="text-sm text-muted-foreground">
                                        No image selected.
                                    </p>

                                )}


                                {/* Zoom overlay */}

                                {imagePreviewUrl && (

                                    <div
                                        className="
                                            absolute
                                            bottom-3
                                            right-3
                                            flex
                                            items-center
                                            gap-1
                                            rounded-lg
                                            bg-black/60
                                            px-3
                                            py-2
                                            text-xs
                                            text-white
                                        "
                                    >

                                        <ZoomInRounded
                                            fontSize="small"
                                        />

                                        Click to enlarge

                                    </div>

                                )}

                            </div>


                            <p className="mt-2 text-xs text-muted-foreground">
                                Click the image to view it in a larger size.
                            </p>


                        </div>


                        {/* ==================================
                            OCR TEXT
                        ================================== */}

                        <div>

                            <p className="mb-2 text-sm font-semibold text-foreground">
                                Extracted Text
                            </p>


                            {ocrLoading ? (

                                <div
                                    className="
                                        flex
                                        min-h-[300px]
                                        flex-col
                                        items-center
                                        justify-center
                                        gap-4
                                        rounded-xl
                                        border
                                        border-border
                                        bg-muted/20
                                    "
                                >

                                    <CircularProgress />

                                    <div className="text-center">

                                        <p className="font-medium">
                                            Extracting text...
                                        </p>

                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {ocrProgress}%
                                        </p>

                                    </div>

                                </div>

                            ) : ocrError ? (

                                <div
                                    className="
                                        flex
                                        min-h-[300px]
                                        items-center
                                        justify-center
                                        rounded-xl
                                        border
                                        border-destructive
                                        bg-destructive/5
                                        p-6
                                        text-center
                                    "
                                >

                                    <p className="text-sm text-destructive">
                                        {ocrError}
                                    </p>

                                </div>

                           ) : noTextDetected ? (

                                <div
                                    className="
                                        flex
                                        min-h-[300px]
                                        flex-col
                                        items-center
                                        justify-center
                                        rounded-xl
                                        border
                                        border-border
                                        bg-muted/20
                                        p-6
                                        text-center
                                    "
                                >

                                    <ImageRounded
                                        sx={{
                                            fontSize: 48,
                                            color: "text.secondary",
                                            mb: 2,
                                        }}
                                    />

                                    <p className="font-semibold text-foreground">
                                        No text detected
                                    </p>

                                    <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                                        We couldn't find readable text in this image.
                                        Please upload an image containing a clear
                                        SMS, WhatsApp message, email, or other text.
                                    </p>

                                </div>

                            ) : (

                                <TextField
                                    multiline
                                    fullWidth
                                    minRows={14}
                                    value={extractedText}
                                    onChange={(event) =>
                                        setExtractedText(
                                            event.target.value
                                        )
                                    }
                                    placeholder="Extracted text will appear here..."
                                    helperText="You can edit the extracted text before using it."
                                />

                            )}

                        </div>

                    </div>

                </DialogContent>


                {/* ==========================================
                    ACTIONS
                ========================================== */}

                <DialogActions
    sx={{
        px: 3,
        py: 2,
        gap: 1,
    }}
>
    <Button
        variant="outlined"
        onClick={handleClose}
        disabled={ocrLoading}
        sx={{
            textTransform: "none",
            fontWeight: 600,
            borderColor: "#4F46E5",
            color: "#4F46E5",
            "&:hover": {
                borderColor: "#4338CA",
                backgroundColor: "rgba(79, 70, 229, 0.04)",
            },
        }}
    >
        Cancel
    </Button>

    <Button
        variant="outlined"
        startIcon={<UploadRounded />}
        onClick={handleSelectAnotherImage}
        disabled={ocrLoading}
        sx={{
            textTransform: "none",
            fontWeight: 600,
            borderColor: "#4F46E5",
            color: "#4F46E5",
            "&:hover": {
                borderColor: "#4338CA",
                backgroundColor: "rgba(79, 70, 229, 0.04)",
            },
        }}
    >
        Select Another Image
    </Button>

    <Button
        variant="contained"
        onClick={handleUseText}
        disabled={
            ocrLoading ||
            !extractedText.trim()
        }
        sx={{
            textTransform: "none",
            fontWeight: 600,
            backgroundColor: "#4F46E5",
            "&:hover": {
                backgroundColor: "#4338CA",
            },
        }}
    >
        Use This Text
    </Button>
</DialogActions>

            </Dialog>


            {/* ==========================================
                LARGE IMAGE VIEWER
            ========================================== */}

            <Dialog
                open={imageViewerOpen}
                onClose={() =>
                    setImageViewerOpen(false)
                }
                maxWidth="xl"
            >

                <DialogContent
                    sx={{
                        p: 1,
                        position: "relative",
                        backgroundColor: "black",
                    }}
                >

                    <IconButton
                        onClick={() =>
                            setImageViewerOpen(false)
                        }
                        sx={{
                            position: "absolute",
                            right: 8,
                            top: 8,
                            zIndex: 2,
                            color: "white",
                            backgroundColor:
                                "rgba(0,0,0,0.5)",
                        }}
                    >
                        <CloseRounded />
                    </IconButton>


                    {imagePreviewUrl && (

                        <img
                            src={imagePreviewUrl}
                            alt="Enlarged uploaded image"
                            className="
                                max-h-[85vh]
                                max-w-[90vw]
                                object-contain
                            "
                        />

                    )}

                </DialogContent>

            </Dialog>

        </>
    );

}


export default OCRTextDialog;