import {
    Button
} from "@mui/material";

import UploadFileRoundedIcon from "@mui/icons-material/UploadFileRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";


function UploadDatasetCard({

    loading,
    batchLoading,
    selectedFile,
    setSelectedFile,
    isSingleMessageMode,
    onAnalyzeDataset

}) {


    // ==========================================
    // FILE SELECTION
    // ==========================================

    const handleFileChange = (event) => {

        const file =
            event.target.files[0];

        if (!file) {
            return;
        }


        const allowedExtensions = [
            ".xlsx",
            ".xls",
            ".csv"
        ];


        const fileName =
            file.name.toLowerCase();


        const validExtension =
            allowedExtensions.some(
                (extension) =>
                    fileName.endsWith(extension)
            );


        if (!validExtension) {

            alert(
                "Please upload an Excel or CSV file."
            );

            return;

        }


        const MAX_SIZE =
            10 * 1024 * 1024;


        if (file.size > MAX_SIZE) {

            alert(
                "File size must be less than 10 MB."
            );

            return;

        }


        setSelectedFile(file);

    };


    // ==========================================
    // REMOVE FILE
    // ==========================================

    const handleRemoveFile = () => {

        setSelectedFile(null);

    };


    return (

        <div
            className="
                flex
                w-full
                flex-1
                items-center
                justify-center
                rounded-xl
                border-2
                border-dashed
                border-primary/40
                bg-primary/[0.03]
                p-6
            "
        >

            <div
                className="
                    flex
                    w-full
                    flex-col
                    items-center
                    justify-center
                    text-center
                "
            >

                {/* ==========================================
                    UPLOAD ICON
                ========================================== */}

                <UploadFileRoundedIcon
                    sx={{
                        fontSize: 70,
                        color: "var(--primary)",
                        mb: 2
                    }}
                />


                {/* ==========================================
                    TITLE
                ========================================== */}

                <h3 className="text-2xl font-bold text-foreground">
                    Upload Excel Dataset
                </h3>


                <p className="mt-1 text-sm text-muted-foreground">
                    Supports .xlsx, .xls and .csv
                </p>


                {/* ==========================================
                    SELECTED FILE
                ========================================== */}

                {selectedFile && (

                    <>

                        <div className="mt-6 flex flex-col items-center">

                            <DescriptionRoundedIcon
                                sx={{
                                    fontSize: 34,
                                    color: "var(--primary)",
                                    mb: 1
                                }}
                            />

                            <p
                                className="
                                    max-w-[90%]
                                    break-words
                                    text-sm
                                    font-bold
                                    text-foreground
                                "
                            >
                                {selectedFile.name}
                            </p>

                        </div>


                        {/* ==========================================
                            READY STATUS
                        ========================================== */}

                        <div className="mt-5 flex flex-col items-center">

                            <CheckCircleRoundedIcon
                                sx={{
                                    fontSize: 42,
                                    color: "#2E7D32",
                                    mb: 1
                                }}
                            />

                            <p className="text-lg font-bold text-green-700 dark:text-green-400">
                                Dataset Ready for Analysis
                            </p>

                        </div>


                        {/* ==========================================
                            ANALYZE DATASET
                        ========================================== */}

                        <Button
                            variant="contained"
                            fullWidth
                            onClick={onAnalyzeDataset}
                            disabled={
                                loading ||
                                batchLoading
                            }
                            sx={{

                                mt: 3,

                                py: 1.4,

                                borderRadius: 2,

                                bgcolor: "#2E7D32",

                                color: "#FFFFFF",

                                textTransform: "none",

                                fontWeight: 700,

                                boxShadow: "none",

                                "&:hover": {

                                    bgcolor: "#256628",

                                    boxShadow: "none"

                                }

                            }}
                        >

                            {batchLoading
                                ? "Analysing Dataset..."
                                : "Analyze Dataset"
                            }

                        </Button>

                    </>

                )}


                {/* ==========================================
                    DISABLED MESSAGE
                ========================================== */}

                {isSingleMessageMode && (

                    <p className="mt-4 text-sm text-orange-600 dark:text-orange-400">
                        Upload is disabled while typing a message.
                    </p>

                )}


                {/* ==========================================
                    CHOOSE FILE
                ========================================== */}

                <Button

                    component="label"

                    variant="contained"

                    disabled={
                        loading ||
                        batchLoading ||
                        isSingleMessageMode
                    }

                    sx={{

                        mt: 3,

                        px: 4,

                        py: 1.2,

                        borderRadius: 2,

                        bgcolor:
                            "var(--primary)",

                        color:
                            "var(--primary-foreground)",

                        textTransform:
                            "none",

                        fontWeight: 600,

                        boxShadow:
                            "none",

                        "&:hover": {

                            bgcolor:
                                "var(--primary-hover)",

                            boxShadow:
                                "none"

                        }

                    }}

                >

                    {selectedFile
                        ? "Change File"
                        : "Choose File"
                    }

                    <input
                        hidden
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileChange}
                    />

                </Button>


                {/* ==========================================
                    REMOVE FILE
                ========================================== */}

                {selectedFile && (

                    <Button

                        startIcon={
                            <DeleteOutlineRoundedIcon />
                        }

                        color="error"

                        disabled={
                            batchLoading
                        }

                        onClick={
                            handleRemoveFile
                        }

                        sx={{
                            mt: 2,
                            textTransform: "none"
                        }}

                    >
                        Remove File
                    </Button>

                )}

            </div>

        </div>

    );

}

export default UploadDatasetCard;