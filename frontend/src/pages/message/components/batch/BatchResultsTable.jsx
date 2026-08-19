import { DataGrid } from "@mui/x-data-grid";

import BatchAnalysisDialog from "./BatchAnalysisDialog";


function BatchResultsTable({
    rows,
    selectedRow,
    setSelectedRow,
    dialogOpen,
    setDialogOpen
}) {


    // ==========================================
    // TABLE COLUMNS
    // ==========================================

    const columns = [

        {
            field: "Text",

            headerName: "Message",

            flex: 3.2,

            minWidth: 320,

            valueGetter: (value) => {

                if (!value) {
                    return "";
                }

                return value.length > 120
                    ? value.substring(0, 120) + "..."
                    : value;

            }

        },


        {
            field: "Predicted Scam Type",

            headerName: "Scam Type",

            flex: 1.1,

            minWidth: 130

        },


        {
            field: "Confidence Score (ML Model)",

            headerName: "Confidence",

            flex: 1.2,

            minWidth: 135

        },


        {
            field:
                "Risk Level (Final ScamSense Assessment)",

            headerName: "Risk",

            flex: 0.7,

            minWidth: 90

        }

    ];


    // ==========================================
    // FORMAT ROWS
    // ==========================================

    const formattedRows =
        (rows || []).map(
            (row, index) => ({
                id: index + 1,
                ...row
            })
        );


    return (

        <div
            className="
                mt-4
                overflow-hidden
                rounded-xl
                border
                border-border
                bg-card
                text-card-foreground
            "
        >


            {/* ==========================================
                HEADER
            ========================================== */}

            <div className="px-6 pt-6">

                <h2
                    className="
                        text-xl
                        font-bold
                        text-foreground
                    "
                >

                    Batch Analysis Results

                </h2>


                <p
                    className="
                        mt-2
                        text-sm
                        text-muted-foreground
                    "
                >

                    Click any row to view the full AI analysis.

                </p>

            </div>


            {/* ==========================================
                DATA GRID
            ========================================== */}

            <div className="mt-4 w-full">

                <DataGrid

                    rows={formattedRows}

                    columns={columns}

                    disableRowSelectionOnClick

                    /*
                     * Allow users to display more
                     * messages per page.
                     */

                    pageSizeOptions={[
                        5,
                        10,
                        20,
                        50,
                        100,
                        200
                    ]}


                    initialState={{

                        pagination: {

                            paginationModel: {

                                pageSize: 5,

                                page: 0

                            }

                        }

                    }}


                    getRowHeight={() => "auto"}


                    onRowClick={(params) => {

                        setSelectedRow(params.row);

                        setDialogOpen(true);

                    }}


                    sx={{

                        /*
                         * ==========================================
                         * MAIN DATAGRID
                         * ==========================================
                         */

                        border: "none",

                        color:
                            "var(--foreground) !important",

                        backgroundColor:
                            "var(--card) !important",

                        fontFamily: "inherit",


                        /*
                         * ==========================================
                         * COLUMN HEADER CONTAINER
                         *
                         * !important is intentional here because
                         * MUI's default DataGrid styling can override
                         * the application's theme.
                         * ==========================================
                         */

                        "& .MuiDataGrid-columnHeaders": {

                            backgroundColor:
                                "var(--muted) !important",

                            color:
                                "var(--foreground) !important",

                            borderBottom:
                                "1px solid var(--border) !important"

                        },


                        /*
                         * ==========================================
                         * INDIVIDUAL COLUMN HEADERS
                         * ==========================================
                         */

                        "& .MuiDataGrid-columnHeader": {

                            backgroundColor:
                                "var(--muted) !important",

                            color:
                                "var(--foreground) !important"

                        },


                        /*
                         * ==========================================
                         * COLUMN HEADER TEXT
                         * ==========================================
                         */

                        "& .MuiDataGrid-columnHeaderTitle": {

                            fontWeight: 700,

                            color:
                                "var(--foreground) !important"

                        },


                        /*
                         * ==========================================
                         * SORT ICON
                         * ==========================================
                         */

                        "& .MuiDataGrid-sortIcon": {

                            color:
                                "var(--muted-foreground) !important"

                        },


                        /*
                         * ==========================================
                         * COLUMN HEADER MENU / ICON
                         * ==========================================
                         */

                        "& .MuiDataGrid-menuIconButton": {

                            color:
                                "var(--muted-foreground) !important"

                        },


                        "& .MuiDataGrid-iconButtonContainer": {

                            color:
                                "var(--muted-foreground) !important"

                        },


                        /*
                         * ==========================================
                         * COLUMN SEPARATOR
                         * ==========================================
                         */

                        "& .MuiDataGrid-columnSeparator": {

                            color:
                                "var(--border) !important"

                        },


                        /*
                         * ==========================================
                         * ROWS
                         * ==========================================
                         */

                        "& .MuiDataGrid-row": {

                            cursor: "pointer",

                            borderBottom:
                                "1px solid var(--border) !important",

                            backgroundColor:
                                "var(--card) !important"

                        },


                        /*
                         * ==========================================
                         * ROW HOVER
                         * ==========================================
                         */

                        "& .MuiDataGrid-row:hover": {

                            backgroundColor:
                                "color-mix(in oklch, var(--primary) 8%, transparent) !important"

                        },


                        /*
                         * ==========================================
                         * CELLS
                         * ==========================================
                         */

                        "& .MuiDataGrid-cell": {

                            whiteSpace: "normal",

                            wordBreak: "break-word",

                            lineHeight: 1.6,

                            alignItems: "flex-start",

                            paddingTop: "16px",

                            paddingBottom: "16px",

                            color:
                                "var(--foreground) !important",

                            borderBottom: "none"

                        },


                        /*
                         * ==========================================
                         * CELL CONTENT
                         * ==========================================
                         */

                        "& .MuiDataGrid-cellContent": {

                            whiteSpace: "normal",

                            overflow: "visible",

                            textOverflow: "unset",

                            color:
                                "var(--foreground) !important"

                        },


                        /*
                         * ==========================================
                         * FOOTER
                         * ==========================================
                         */

                        "& .MuiDataGrid-footerContainer": {

                            backgroundColor:
                                "var(--card) !important",

                            borderTop:
                                "1px solid var(--border) !important",

                            color:
                                "var(--foreground) !important"

                        },


                        /*
                         * ==========================================
                         * PAGINATION
                         * ==========================================
                         */

                        "& .MuiTablePagination-root": {

                            color:
                                "var(--foreground) !important"

                        },


                        /*
                         * "Rows per page:"
                         * ==========================================
                         */

                        "& .MuiTablePagination-selectLabel": {

                            color:
                                "var(--muted-foreground) !important"

                        },


                        /*
                         * "1–4 of 4"
                         * ==========================================
                         */

                        "& .MuiTablePagination-displayedRows": {

                            color:
                                "var(--muted-foreground) !important"

                        },


                        /*
                         * ==========================================
                         * PAGE SIZE SELECT
                         * ==========================================
                         */

                        "& .MuiTablePagination-select": {

                            color:
                                "var(--foreground) !important"

                        },


                        /*
                         * ==========================================
                         * PAGE SIZE SELECT ICON
                         * ==========================================
                         */

                        "& .MuiTablePagination-selectIcon": {

                            color:
                                "var(--muted-foreground) !important"

                        },


                        /*
                         * ==========================================
                         * PAGINATION BUTTONS
                         * ==========================================
                         */

                        "& .MuiTablePagination-actions button": {

                            color:
                                "var(--foreground) !important"

                        },


                        /*
                         * ==========================================
                         * DISABLED PAGINATION BUTTONS
                         * ==========================================
                         */

                        "& .MuiTablePagination-actions button.Mui-disabled": {

                            color:
                                "var(--muted-foreground) !important",

                            opacity: 0.5

                        },


                        /*
                         * ==========================================
                         * MUI SELECT MENU
                         *
                         * The dropdown itself is rendered outside
                         * the DataGrid, so we also force its theme
                         * using the global class selector.
                         * ==========================================
                         */

                        "& .MuiSelect-select": {

                            color:
                                "var(--foreground) !important"

                        }

                    }}

                />

            </div>


            {/* ==========================================
                FULL ANALYSIS DIALOG
            ========================================== */}

            <BatchAnalysisDialog

                open={dialogOpen}

                row={selectedRow}

                onClose={() => {

                    setDialogOpen(false);

                    setSelectedRow(null);

                }}

            />

        </div>

    );

}


export default BatchResultsTable;