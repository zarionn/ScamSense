import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import FindInPageRoundedIcon from "@mui/icons-material/FindInPageRounded";


function InfoCard({

    title,

    content

}) {

    const isSummary =
        title === "AI Summary";


    return (

        <div
            className="
                mt-3
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

            <div
                className={`
                    flex
                    items-center
                    gap-3
                    border-b
                    border-border
                    px-6
                    py-4
                    ${
                        isSummary
                            ? "bg-primary/10"
                            : "bg-orange-500/10"
                    }
                `}
            >

                {isSummary ? (

                    <AutoAwesomeRoundedIcon
                        sx={{
                            color: "var(--primary)"
                        }}
                    />

                ) : (

                    <FindInPageRoundedIcon
                        sx={{
                            color: "#F57C00"
                        }}
                    />

                )}


                <h3 className="text-lg font-bold text-foreground">

                    {isSummary
                        ? "AI Explanation"
                        : title
                    }

                </h3>

            </div>


            {/* ==========================================
                BODY
            ========================================== */}

            <div className="p-6">

                <p className="text-[15.5px] leading-8 text-foreground">
                    {content}
                </p>

            </div>

        </div>

    );

}

export default InfoCard;