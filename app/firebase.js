let db

function init() {
    if (!db) {
        const admin = require('firebase-admin')
        const {getFirestore} = require('firebase-admin/firestore')
        const credential = admin.credential.cert('firebase-key.json')
        const app = admin.initializeApp({credential})
        db = getFirestore(app)
    }
}

exports.setDoc = (data, ...collection) => {
    init()
    db.doc(collection.join('/')).set(data)
}
