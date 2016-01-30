/* 

Modelo de datos de canciones (track)

track_id: {
	name: nombre de la canción,
	url: url del fichero de audio
	name_cover: nombre de la carátula
	url_cover: url de la carátula
} 

*/

var mongoose = require('mongoose'),  
    Schema   = mongoose.Schema;

var trackSchema = new Schema({  
	name:       { type: String },
	url:        { type: String },
	name_cover: { type: String },
	url_cover:  { type: String }
});

module.exports = mongoose.model('Track', trackSchema);  
