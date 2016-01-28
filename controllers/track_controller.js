var fs = require('fs');
var express = require('express');
var http = require('http');
var querystring = require('querystring');
var mongoose = require('mongoose');
var needle = require('needle');
var Tracks = mongoose.model('Track');

// Devuelve una lista de las canciones disponibles y sus metadatos
exports.list = function (req, res) {
	// Busca en la base de datos las canciones existentes para mostrarlas en una lista
	Tracks.find(function (err, tracks) {
		if (err) res.send(500, err.message);
		res.render('tracks/index', { tracks: tracks });
	});
};

// Devuelve la vista del formulario para subir una nueva canción
exports.new = function (req, res) {
	res.render('tracks/new');
};

// Devuelve la vista de reproducción de una canción.
// El campo track.url contiene la url donde se encuentra el fichero de audio
exports.show = function (req, res) {
	console.log(req.params);
	Tracks.findOne({name: req.params.trackId}, function(err, track) {
		if (err) return res.send(500, err.message);
		res.render('tracks/show', { track: track });
	});
};

// Escribe una nueva canción en el registro de canciones.
// Escribe en tracks.cdpsfy.es el fichero de audio contenido en req.files.track.buffer
// Escribe en la base de datos la verdadera url generada al añadir el fichero en el servidor tracks.cdpsfy.es
exports.create = function (req, res) {
	var track = req.files.track;
	// Si la cancion es undefined no se ha introducido nada
	if (track !== undefined) {
		console.log('Nuevo fichero de audio. Datos: ', track);
		var id = track.name.split('.')[0];
		var name = track.originalname.split('.')[0];
		var datos = track.buffer;
		var original = track.originalname; 
		var ext = track.extension;
		// Si la extension no se corresponde con un fichero de audio, no hacemos nada
		if (ext == 'mp3' || ext == 'ogg' || ext== 'wav') {
			console.log(ext);
			var image = req.files.image;
			// Si la imagen no existe, ponemos una por defecto
			if (image !== undefined) {
				console.log('Nueva portada. Datos: ', image);
				var nameImg = image.originalname.split('.')[0];
				var datosImg =  image.buffer;
				var originalImg = image.originalname;
				var ext1 = image.extension;
				// Comprobamos la extensión de la imagen
				if (ext1 == 'bmp' || ext1 == 'jpg' || ext1 == 'png' || ext1 == 'jpeg' || ext1 == 'gif') {
					// archivos enviados en la petición post al servidor
					var data = {
						image: {
							buffer      : datosImg,
							filename    : image.originalname,
							content_type: image.mimetype
						},
						track: {
							buffer      : datos,
							filename    : track.originalname,
							content_type: track.mimetype
						}
					}
					// Esta url debe ser la correspondiente al nuevo fichero en tracks.cdpsfy.es
					var url = 'http://tracks.cdpsfy.es/cancion/' + track.originalname;
					var urlImg = 'http://tracks.cdpsfy.es/imagen/' + image.originalname;
					// Escribe los metadatos de la nueva canción en el registro.
					var new_track = new Tracks({
						name: name,
						url: url,
						imgname: image.originalname,
						urlImg: urlImg
					});
					// Guardamos la canción en la Base de datos
					new_track.save(function(err, new_track) {
						if (err) {
							console.log('Error al subir el audio: ' + err);
						};
					});
					// Mandamos la petición POST al servidor para guardar la canción y la imagen
					needle.post('http://tracks.cdpsfy.es', data, { multipart: true }, function optionalCallback(err, httpResponse, body) {
						console.log("Se está subiendo");						  
						if (err) {
							return console.error('upload failed:', err);
						}
						console.log('Upload successful!  Server responded with:', body);
						res.redirect('/tracks');
					});
				} else {
					console.log('Introduzca una imagen. Extensiones soportadas: gif, bmp, jpg, png, jpeg');
				}
			} else {
				var data = {
					track: {
						buffer      : datos,
						filename    : track.originalname,
						content_type: track.mimetype
					}
				}
				var url = 'http://tracks.cdpsfy.es/cancion/' + track.originalname;
				var urlImg = 'http://tracks.cdpsfy.es/imagen/default_cover.png';
				//Escribe los metadatos de la nueva canción en la base de datos.
				var new_track = new Tracks({
					name: name,
					url: url,
					imgname: '',
					urlImg: urlImg
				});
				new_track.save(function(err, new_track) {
					if (err) {
						console.log('Error al subir el audio: ' + err);
					};
				});
				// Mandamos la petición POST al servidor para guardar la canción
				needle.post('http://tracks.cdpsfy.es', data, {multipart: true}, function optionalCallback(err, httpResponse, body) {
					if (err) {
						return console.error('upload failed:', err);
					}
					console.log('Upload successful!  Server responded with:', body);
					res.redirect('/tracks');
				});
			}
		} else { 
			console.log('Introduzca una cancion con la extension adecuada. Extensiones soportadas: mp3, ogg y wav');
			// redirigimos al index
			res.redirect('/tracks');
		}
	} else { 
		console.log('Introduzca una canción');
		res.redirect('/tracks');
	}
};

// Borra una canción (trackId) de la base de datos 
// Eliminar en tracks.cdpsfy.es el fichero de audio correspondiente a trackId
exports.destroy = function (req, res) {
	Tracks.findOne({name: req.params.trackId}, function (err, track) {
		if (track.imgname !== '') {
			needle.request('delete', 'http://tracks.cdpsfy.es/imagen/' + track.imgname, null, function(err, resp) {
			if (err) {
				return console.error('Delete failed:', err);
			}
			console.log('Delete successful!  Server responded with:', resp.body);
			});
		}
		// Borra la canción de la base de datos
		track.remove(function (err, track) {
			if (err) {
				console.log('Error al borrar el audio: ' + err);
			}
		});
	});
	// Petición HTTP para borrar la canción del servidor nas
	needle.request('delete', 'http://tracks.cdpsfy.es/cancion/' + req.params.trackId + '.ogg', null, function(err, resp) {
		if (err) {
			return console.error('Delete failed:', err);
		}
		console.log('Delete successful!  Server responded with:', resp.body);
	});
	res.redirect('/tracks');
};
