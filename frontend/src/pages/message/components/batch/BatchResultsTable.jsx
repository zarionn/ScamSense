import { DataGrid } from "@mui/x-data-grid";

import BatchAnalysisDialog from "./BatchAnalysisDialog";

function BatchResultsTable({
    rows,
    selectedRow,
    setSelectedRow,
    dialogOpen,
    setDialogOpen
}) {

    const columns = [

        {
            field: "Text",
            headerName: "Message",
            flex: 3,
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
            flex: 1.4,
            minWidth: 150
        },

        {
            field: "Confidence Score (ML Model)",
            headerName: "Confidence",
            flex: 1,
            minWidth: 120
        },

        {
            field: "Risk Level (Final ScamSense Assessment)",
            headerName: "Risk",
            flex: 0.8,
            minWidth: 100
        }

    ];

    const formattedRows = (rows || []).map(
        (row, index) => ({
            id: index + 1,
            ...row
        })
    );

    return (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card text-card-foreground">

            {/* ==========================================
                HEADER
            ========================================== */}

            <div className="px-6 pt-6">

                <h2 className="text-xl font-bold text-foreground">
                    Batch Analysis Results
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
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

                    pageSizeOptions={[5, 10, 20]}

                    initialState={{
                        pagination: {
                            paginationModel: {
                                pageSize: 5
                            }
                        }
                    }}

                    getRowHeight={() => "auto"}

                    onRowClick={(params) => {

                        setSelectedRow(params.row);

                        setDialogOpen(true);

                    }}

                    sx={{

                        border: "none",

                        color: "var(--foreground)",

                        backgroundColor: "transparent",

                        fontFamily: "inherit",

                        "& .MuiDataGrid-columnHeaders": {
                            fontWeight: 700,
                            backgroundColor: "var(--muted)",
                            color: "var(--foreground)",
                            borderBottom: "1px solid var(--border)"
                        },

                        "& .MuiDataGrid-columnHeaderTitle": {
                            fontWeight: 700
                        },

                        "& .MuiDataGrid-columnSeparator": {
                            color: "var(--border)"
                        },

                        "& .MuiDataGrid-row": {
                            cursor: "pointer",
                            borderBottom: "1px solid var(--border)"
                        },

                        "& .MuiDataGrid-row:hover": {
                            backgroundColor: "color-mix(in oklch, var(--primary) 8%, transparent)"
                        },

                        "& .MuiDataGrid-cell": {
                            whiteSpace: "normal",
                            wordBreak: "break-word",
                            lineHeight: 1.6,
                            alignItems: "flex-start",
                            paddingTop: "16px",
                            paddingBottom: "16px",
                            color: "var(--foreground)",
                            borderBottom: "none"
                        },

                        "& .MuiDataGrid-cellContent": {
                            whiteSpace: "normal",
                            overflow: "visible",
                            textOverflow: "unset"
                        },

                        "& .MuiTablePagination-root": {
                            color: "var(--foreground)"
                        },

                        "& .MuiTablePagination-selectLabel": {
                            color: "var(--muted-foreground)"
                        },

                        "& .MuiTablePagination-displayedRows": {
                            color: "var(--muted-foreground)"
                        },

                        "& .MuiDataGrid-footerContainer": {
                            borderTop: "1px solid var(--border)"
                        },

                        "& .MuiDataGrid-iconButtonContainer": {
                            color: "var(--muted-foreground)"
                        },

                        "& .MuiDataGrid-menuIconButton": {
                            color: "var(--muted-foreground)"
                        },

                        "& .MuiDataGrid-sortIcon": {
                            color: "var(--muted-foreground)"
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