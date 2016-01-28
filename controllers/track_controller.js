var express = require('express');
var fs = require('fs');
var http = require('http');
var mongoose = require('mongoose');
var needle = require('needle');
var Tracks = mongoose.model('Track');

// Devuelve una lista de las canciones disponibles y sus metadatos
exports.list = function (req, res) {
	// Busca las canciones existentes en la base de datos para mostrarlas en la lista
	Tracks.find(function (err, tracks) {
		if (err) res.send(500, err.message);
		res.render('tracks/index', { tracks: tracks });
	});
}

// Devuelve la vista del formulario para subir una nueva canción
exports.new = function (req, res) {
	res.render('tracks/new');
}

// Devuelve la vista de reproducción de una canción
// El campo track.url contiene la url donde se encuentra el fichero de audio
exports.show = function (req, res) {
	console.log(req.params);
	Tracks.findOne({name: req.params.trackId}, function(err, track) {
		if (err) return res.send(500, err.message);
		res.render('tracks/show', { track: track });
	});
}

// Escribe una nueva canción en el registro de canciones
// Escribe en tracks.cdpsfy.es el fichero de audio contenido en req.files.track.buffer
// Escribe en la base de datos la verdadera url generada al añadir el fichero en el servidor tracks.cdpsfy.es
exports.create = function (req, res) {
	var track = req.files.track;
	if (!track) {
		console.log('ERROR: Please select the track to be uploaded \n');
		res.redirect('/tracks');
	} else if (['mp3', 'ogg', 'wav'].indexOf(track.extension) < 0) {
		console.log('ERROR: Please upload .mp3, .ogg or .wav tracks \n');
		res.redirect('/tracks');
	} else {
		console.log('INFO: New track being uploaded: \n', track);
		var image = req.files.image;
		if (!image) {
			var data = {
				track: {
					buffer      : track.buffer,
					filename    : track.originalname,
					content_type: track.mimetype
				}
			}
			var url = 'http://tracks.cdpsfy.es/cancion/' + track.originalname;
			var urlImg = 'http://tracks.cdpsfy.es/imagen/default_cover.png';
			// Guarda los metadatos de la canción en la base de datos
			var new_track = new Tracks({
				name: track.originalname.split('.')[0],
				url: url,
				imgname: '',
				urlImg: urlImg
			});
			new_track.save(function(err, new_track) {
				if (err) console.log('ERROR: ' + err);
			});
			// Petición POST al servidor para guardar la canción
			needle.post('http://tracks.cdpsfy.es', data, { multipart: true }, function optionalCallback(err, httpResponse, body) {
				if (err) return console.error('ERROR: ' + err + '\n');
				console.log('OK: Track uploaded successfully \n');
				res.redirect('/tracks');
			});
		} else if (['bmp', 'gif', 'jpg', 'jpeg', 'png'].indexOf(image.extension) < 0) {
			console.log('ERROR: Please upload .gif, .bmp, .jpg (.jpeg) or .png images \n');
		} else {
			console.log('INFO: New cover being uploaded: \n', image);
			var data = {
				image: {
					buffer      : image.buffer,
					filename    : image.originalname,
					content_type: image.mimetype
				},
				track: {
					buffer      : track.buffer,
					filename    : track.originalname,
					content_type: track.mimetype
				}
			}
			// Esta url es la correspondiente al nuevo fichero en tracks.cdpsfy.es
			var url = 'http://tracks.cdpsfy.es/cancion/' + track.originalname;
			var urlImg = 'http://tracks.cdpsfy.es/imagen/' + image.originalname;
			// Escribe los metadatos de la nueva canción en el registro
			var new_track = new Tracks({
				name: track.originalname.split('.')[0],
				url: url,
				imgname: image.originalname,
				urlImg: urlImg
			});
			new_track.save(function(err, new_track) {
				if (err) console.log('ERROR: ' + err);
			});
			// Petición POST al servidor para guardar la canción y la imagen
			needle.post('http://tracks.cdpsfy.es', data, { multipart: true }, function optionalCallback(err, httpResponse, body) {
				if (err) return console.error('ERROR: ' + err + '\n');
				console.log('OK: Track and cover uploaded successfully \n');
				res.redirect('/tracks');
			});
		}
	}
}

// Borra una canción (trackId) de la base de datos 
// Borra en tracks.cdpsfy.es el fichero de audio correspondiente a trackId
exports.destroy = function (req, res) {
	console.log('\nINFO: Track being deleted');
	// Borra el fichero de audio indetificado por trackId en tracks.cdpsfy.es
	needle.request('delete', 'http://tracks.cdpsfy.es/cancion/' + req.params.trackId + '.ogg', null, function(err, resp) {
		if (err) return console.error('ERROR: ' + err + '\n');
		console.log('OK: Track deleted successfully');
	});
	Tracks.findOne({name: req.params.trackId}, function (err, track) {
		if (track.imgname !== '') {
			console.log('INFO: Cover being deleted');
			needle.request('delete', 'http://tracks.cdpsfy.es/imagen/' + track.imgname, null, function(err, resp) {
				if (err) return console.error('ERROR: ' + err + '\n');
				console.log('OK: Cover deleted successfully');
			});
		}
		// Borra la canción de la base de datos
		track.remove(function (err, track) {
			if (err) console.log('ERROR deleting track from database: ' + err);
		});
	});
	res.redirect('/tracks');
}
