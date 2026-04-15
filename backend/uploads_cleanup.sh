#!/bin/bash

# Skript na automatické čistenie priečinka 'uploads'
# Tento skript vymaže obsah priečinka a potom čaká na ďalší cyklus.

# Získanie absolútnej cesty k priečinku 'uploads'
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
TARGET_DIR="$SCRIPT_DIR/uploads"

# Interval čistenia v sekundách (3600 s = 1 hodina)
CLEANUP_INTERVAL=3600

echo "----------------------------------------------------------"
echo "Služba čistenia nahrávok spustená pre: $TARGET_DIR"
echo "Interval čistenia: $CLEANUP_INTERVAL sekúnd"
echo "----------------------------------------------------------"

while true; do
    echo "[$(date)] Spúšťam čistenie..."

    if [ -d "$TARGET_DIR" ]; then
        # Skontrolujeme, či v priečinku niečo je
        if [ "$(ls -A "$TARGET_DIR")" ]; then
            # Vymažeme všetko vnútri, ale ponecháme samotný priečinok
            find "$TARGET_DIR" -mindepth 1 -delete
            echo "[$(date)] Priečinok bol úspešne vyčistený."
        else
            echo "[$(date)] Priečinok je prázdny, nič sa nevymazalo."
        fi
    else
        echo "[$(date)] CHYBA: Priečinok $TARGET_DIR neexistuje!"
    fi

    echo "[$(date)] Čakám $CLEANUP_INTERVAL sekúnd do ďalšieho čistenia..."
    sleep $CLEANUP_INTERVAL
done
