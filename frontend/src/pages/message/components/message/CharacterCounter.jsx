function CharacterCounter({
    current,
    max
}) {

    const exceeded = current > max;

    return (

        <span
            className={
                exceeded
                    ? "text-xs text-destructive"
                    : "text-xs text-muted-foreground"
            }
        >
            {current}/{max}
        </span>

    );

}

export default CharacterCounter;