angular.module('moped.radio', [
  'moped.mopidy',
  'ngRoute'
])

.factory('radioservice', function($http, $window) {
  var DIRBLE_API_KEY= '58617094d08a7c1699efe88cbde26467901cbd19';
  var DIRBLE_API_ENDPOINT = 'http://api.dirble.com/v1/';

  function getStations() {
    var stationsFromStorage = $window.localStorage['stations'];
    if (stationsFromStorage && stationsFromStorage !== '') {
      return JSON.parse(stationsFromStorage);
    }
    else {
      return [{
        "name": "mth.house",
        "uri": "http://house.mthn.net:8500"
      },
      {
        "name": "mth.main",
        "uri": "http://main.mthn.net:8000"
      },
      {
        "name": "YouFM",
        "uri": "http://hr-mp3-m-youfm.akacast.akamaistream.net/7/246/142136/v1/gnl.akacast.akamaistream.net/hr-mp3-m-youfm"
      },
      {
        "name": "Rautemusik.fm Main",
        "uri": "http://main-high.rautemusik.fm"
      },
      {
        "name": "Rautemusik.fm Charthits",
        "uri": "http://charthits-high.rautemusik.fm"
      },
      {
        "name": "Rautemusik.fm Rock",
        "uri": "http://rock-high.rautemusik.fm"
      },
      {
        "name": "Housetime.fm",
        "uri": "http://listen.housetime.fm/tunein-mp3-pls"
      },{
        "name": "SWR3",
        "uri": "http://swr-mp3-m-swr3.akacast.akamaistream.net/7/720/137136/v1/gnl.akacast.akamaistream.net/swr-mp3-m-swr3"
      }]; 
    }
  }

  function storeStations(stations) {
    $window.localStorage['stations'] = JSON.stringify(stations);
  }

  return {
    getRadioStations: function(callback) {
      var stations = getStations();
      callback(null, stations);
    },
    getRadioStation: function(stationName, callback) {
      var stations = getStations();
      var station = _.find(stations, { name: stationName });
      if (station) {
        callback(null, station);
      }
      else {
        callback({ message: 'Radio station ' + stationName + ' could not be found.' }, null);
      }
    },
    saveRadioStation: function(stationName, stationUri, callback) {
      this.getRadioStation(stationName, function(err, station) {
        var stations = getStations();
        if (station) {
          callback({ message: 'Radio station ' + stationName + ' already exists.'}, null);
        }
        else {
          var newStation = { name: stationName, uri: stationUri };
          stations.push(newStation);
          storeStations(stations);
          callback(null, newStation);
        }
      });
    },
    removeRadioStation: function(stationName, callback) {
      var stations = getStations();
      _.remove(stations, function(station) {
        return station.name === stationName;
      });
      storeStations(stations);
      callback(null, stationName);
    },
    findStations: function(searchQuery, callback) {
      var searchUrl = DIRBLE_API_ENDPOINT + 'search/apikey/' + DIRBLE_API_KEY + '/search/' + searchQuery + '/count/100';

      $http.jsonp('http://whateverorigin.org/get?url=' + encodeURIComponent(searchUrl) + '&callback=JSON_CALLBACK')
        .success(function(data) {
          callback(null, data.contents);
        })
        .error(function(data, status) {
          callback({ message: status + ', ' + data }, null);
        });
    }

  };
})

.config(function config($routeProvider) {
  $routeProvider
    .when('/radio/:stationname?', {
      templateUrl: 'radio/radio.tpl.html',
      controller: 'RadioCtrl',
      title: 'Radio'
    });
})

.controller('RadioMenuCtrl', function RadioMenuController($scope, radioservice) {
  $scope.radiostations = [];

  radioservice.getRadioStations(function(err, stations) {
    if (! err) {
      _.forEach(stations, function(station) {
        $scope.radiostations.push(station);
      });
    }
  });
  $scope.$on('moped:radiostationadded', function(event, station) {
    $scope.radiostations.push(station);
  });
  $scope.$on('moped:radiostationremoved', function(event, stationName) {
    _.remove($scope.radiostations, function(station) {
      return station.name === stationName;
    });
  });
})

.controller('RadioCtrl', function RadioController($scope, $rootScope, $routeParams, $window, mopidyservice, radioservice, util) {
  var stationName = $routeParams.stationname;

  $scope.currentStreamName = '';
  $scope.currentStreamUri = '';
  $scope.currentStation = null;
  $scope.searchQuery = '';
  $scope.searchResults = [];

  $scope.canAddToFavourites = function() {
    return $window.localStorage && $scope.currentStreamUri !== '' && $scope.currentStation === null;
  };

  $scope.canRemoveFromFavourites = function() {
    return $window.localStorage && $scope.currentStreamName !== '' && $scope.currentStation !== null;
  };

  $scope.play = function() {
    if (util.isValidStreamUri($scope.currentStreamUri)) {
      mopidyservice.playStream($scope.currentStreamUri);
    }
    else {
      alert('Invalid stream address');
    }
  };

  $scope.addToFavourites = function() {
    if ($scope.currentStreamName === '') {
      alert('Please enter a name for the radio station.');
      return;
    }
    radioservice.saveRadioStation($scope.currentStreamName, $scope.currentStreamUri, function(err, station) {
      if (err) {
        alert(err.message);
      }
      else {
        $scope.currentStation = station;
        $scope.currentStreamName = station.name;
        $scope.currentStreamUri = station.uri;
        $rootScope.$broadcast('moped:radiostationadded', station);
      }
    });
  };

  $scope.removeFromFavourites = function() {
    if (confirm('Are you sure?')) {
      radioservice.removeRadioStation($scope.currentStreamName, function(err, stationName) {
        if (err) {
          alert(err.message);
        }
        else {
          $rootScope.$broadcast('moped:radiostationremoved', $scope.currentStreamName);
          $scope.currentStation = null;
          alert('Station ' + stationName + ' is removed from the favourites.');
        }
      });
    }
  };

  $scope.findStream = function() {
      
    document.activeElement.blur();

    $scope.searchResults.splice(0, $scope.searchResults.length);
    radioservice.findStations($scope.searchQuery, function(err, stations) {
      if (err) {
        alert(err.message);
      }
      else {
        _.forEach(stations, function(station) {
          if (station.status == 1) {
            $scope.searchResults.push(station);
          }
        });
      }
    });
  };

  $scope.playStream = function(name, streamUri) {
    $scope.currentStreamUri = streamUri;
    $scope.currentStreamName = name;
    $scope.play();
  };

  // Play stream immediately when station is given.
  if (stationName) {
    radioservice.getRadioStation(stationName, function(err, station) {
      if (err) {
        console.log(err.message);
      }
      else if (station) {
        $scope.currentStreamUri = station.uri;
        $scope.currentStreamName = station.name;
        $scope.currentStation = station;
        $scope.play();
        $scope.isInitializedFromUrl = true;
      }
    });
  }

  $scope.$watch('currentStreamUri', function(value) {
    if (! $scope.isInitializedFromUrl && $scope.currentStation !== null && value !== $scope.currentStation.name) {
      $scope.currentStreamName = '';
      $scope.currentStation = null;
    }
    else if ($scope.isInitializedFromUrl) {
      $scope.isInitializedFromUrl = false;
    }
  });


});

