// Phrasebook content. `say` is what the voice reads aloud.
(function () {
    const categories = {
        essentials: { name: "Essentials", latin: "I" },
        dining: { name: "Eating & Drinking", latin: "II" },
        about: { name: "About Me", latin: "III" }
    };
    const categoryOrder = ["essentials", "dining", "about"];

    // `sound` is a rough English-speaker pronunciation; CAPITALS = stressed syllable.
    const phrases = [
        { id: 1, category: "essentials", english: "Hello / Good day", italian: "Buongiorno", sound: "bwon-JOR-noh" },
        { id: 2, category: "essentials", english: "Thank you", italian: "Grazie", sound: "GRAHT-see-eh" },
        { id: 3, category: "essentials", english: "Please", italian: "Per favore", sound: "pehr fah-VOH-reh" },
        { id: 4, category: "essentials", english: "Excuse me / Sorry", italian: "Mi scusi", sound: "mee SKOO-zee" },
        { id: 5, category: "essentials", english: "Yes / No", italian: "Sì / No", sound: "see / noh", say: "Sì. No." },
        { id: 6, category: "essentials", english: "Do you speak English?", italian: "Parla inglese?", sound: "PAR-lah een-GLEH-zeh" },
        { id: 7, category: "essentials", english: "Where is the toilet?", italian: "Dov'è il bagno?", sound: "doh-VEH eel BAHN-yoh" },

        { id: 8, category: "dining", english: "Table for one, please", italian: "Un tavolo per uno, per favore", sound: "oon TAH-voh-loh pehr OO-noh, pehr fah-VOH-reh" },
        { id: 9, category: "dining", english: "The menu, please", italian: "Il menù, per favore", sound: "eel meh-NOO, pehr fah-VOH-reh" },
        { id: 10, category: "dining", english: "I'll have this one, please", italian: "Prendo questo, per favore", sound: "PREN-doh KWEH-stoh, pehr fah-VOH-reh" },
        { id: 11, category: "dining", english: "No onion, please", italian: "Senza cipolla, per favore", sound: "SEN-tsah chee-POHL-lah, pehr fah-VOH-reh" },
        { id: 12, category: "dining", english: "Water, please", italian: "Acqua, per favore", sound: "AHK-kwah, pehr fah-VOH-reh" },
        { id: 13, category: "dining", english: "A beer, please", italian: "Una birra, per favore", sound: "OO-nah BEER-rah, pehr fah-VOH-reh" },
        { id: 14, category: "dining", english: "It's delicious!", italian: "È delizioso!", sound: "eh deh-lee-TSYOH-zoh" },
        { id: 15, category: "dining", english: "Cheers!", italian: "Salute!", sound: "sah-LOO-teh" },
        { id: 16, category: "dining", english: "The bill, please", italian: "Il conto, per favore", sound: "eel KON-toh, pehr fah-VOH-reh" },

        { id: 17, category: "about", english: "I am from the UK", italian: "Sono del Regno Unito", sound: "SOH-noh del REN-yoh oo-NEE-toh" },
        { id: 18, category: "about", english: "My name is Martyn", italian: "Mi chiamo Martyn", sound: "mee KYAH-moh MAR-tin" }
    ];

    // The exact text spoken for a phrase. Recordings are keyed by this string.
    const speechText = (p) => p.say || p.italian;
    // Every distinct text that needs a recording (used by tools/generate-audio.mjs).
    const allSpeechTexts = () => [...new Set(phrases.map(speechText))];

    globalThis.PHRASEBOOK = { categories, categoryOrder, phrases, speechText, allSpeechTexts };
})();
