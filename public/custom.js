var app = angular.module('app', [
  'angular-loading-bar',
  'ui.router',
  'ui.bootstrap',
  'ngAnimate',
  'ngCookies',
  'ngFitText',
  'xeditable',
])
.config(function($stateProvider, $locationProvider, $uiViewScrollProvider, $urlRouterProvider) {
  $locationProvider.html5Mode(true);
  $uiViewScrollProvider.useAnchorScroll()
  $urlRouterProvider.otherwise("/");

  $stateProvider
    .state('home', {
      url: '/',
      templateUrl: 'partials/index.html'
    })
    .state('faq', {
      url: '/faq',
      templateUrl: 'partials/faq.html'
    })
    .state('demo', {
      url: '/demo',
      templateUrl: 'partials/demo.html',
      controller: 'demoCtrlForward'
    })
    .state('demo.active', {
      templateUrl: 'partials/ledger.html',
      controller: 'demoCtrl'
    })
    .state('pricing', {
      url: '/pricing',
      templateUrl: 'partials/pricing.html'
    })
    .state('listing', {
      url: "/{id:[A-Za-z0-9]{10}}",
      templateUrl: 'partials/ledger.html',
      controller: 'ledgerCtrl'
    });
})
.run(function(editableOptions) {
  editableOptions.theme = 'bs3'; // for xeditable
})
.animation(".fakeMouse", function() {
  return {
    leave: function(element, done) {
      
    },
    enter: function(element, done) {
      var starting = {
        top: element[0].offsetTop,
        left: element[0].offsetLeft
      };

      var ending = {
        top: angular.element("#ledger")[0].offsetTop,
        left: angular.element("#ledger")[0].offsetLeft,
      };

      var point1 = {
        top: ending.top - starting.top,
        left: ending.left - starting.left
      };

      var point2 = {
        top: angular.element("#item0").offset().top - starting.top,
        left: angular.element("#item0").offset().left - starting.left
      };

      var point3 = {
        top: angular.element("#item1").offset().top - starting.top,
        left: angular.element("#item1").offset().left - starting.left
      };

      TweenMax.fromTo(element, 0.5, {x: 0, y: 0}, {x: point1.left - 4, y: point1.top + 15});
      TweenMax.fromTo(element, 0.25, {x: point1.left - 4, y: point1.top + 15}, {x: point2.left - 4, y: point2.top + 18, delay: 0.8});
      TweenMax.fromTo(element, 0.25, {x: point2.left - 4, y: point2.top + 18}, {x: point3.left - 4, y: point3.top + 18, delay: 1.4, onComplete: done});
    }
  }
})
.controller("demoCtrlForward", function($state) {
  $state.go('demo.active');
})
.controller("mainCtrl", function($rootScope, $scope, $http, $location, $timeout, $state) {
  $scope.ledger = {};
  $scope.ledger.name = '';
  $scope.ledger.items = [{placeholder: "Pizza", placeholderPrice: "$20"}, {placeholder: "Soda", placeholderPrice: "$5"}];

  $scope.totalPrice = 0;
  $scope.isFocused = false;
  $scope.isCollapsed = true;
  $scope.loading = false;

  var typingAnimation = function(scope, text) {
    eval(scope + " = '';");
    var counter = 0;
    var interval = setInterval(function() {
      $scope.$apply(function() {
        eval(scope  + " += text.split('')[counter];");
      });
      if(counter >= text.split('').length - 1) {
        clearInterval(interval);
      }
      counter ++;
     }, 10);
  };

  $scope.demo = function() {
    if($rootScope.isDemoPlaying) {
      // in case people click the button twice in a row
      return
    };
    if($location.path() !== '/') {
      $state.go('home');
    }
    $rootScope.isDemoPlaying = true;
    $scope.ledger.items = [{placeholder: "Pizza", placeholderPrice: "$20"}, {placeholder: "Soda", placeholderPrice: "$5"}];
    $timeout(function() {
      typingAnimation('$scope.ledger.name', "Summer BBQ at the beach");
      $timeout(function() {
        typingAnimation('$scope.ledger.items[0].description', "Hamburgers and hotdogs");
        $timeout(function() {
          $scope.ledger.items[0].price = 22.56;
        }, 200)
      }, 600);
      $timeout(function() {
        typingAnimation('$scope.ledger.items[1].description', "Drinks and ice");
        $timeout(function() {
          $scope.ledger.items[1].price = 12.56;
        }, 200)
      }, 1200);

      $timeout(function() {
        $rootScope.isDemoPlaying = false;
        $state.go('demo');
      }, 2100);
    }, 500);
  };

  // hide the navigation bar for certain pages
  $scope.hidden = true;
  $rootScope.$on('$stateChangeSuccess', function() {
    $scope.home = false;
    if($location.path() == '/') {
      $scope.home = true;
      angular.element('.fakeMouse').remove();
      $scope.ledger = {};
      $scope.ledger.name = '';
      $scope.ledger.items = [{placeholder: "Pizza", placeholderPrice: "$20"}, {placeholder: "Soda", placeholderPrice: "$5"}];
    }

    if($location.path() == '/ledger' || $location.path() == '/demo' || $location.path().split('').length == 11) {
      angular.element('.navbar-wrapper').addClass('hidden');
    }
    else {
      angular.element('.navbar-wrapper').removeClass('hidden');
      $scope.hidden = false;
    }
  });

  $scope.add = function() {
    $scope.isFocused = false;
    $scope.ledger.items.push({});
    setTimeout(function() {
      $scope.$apply(function() {
        $scope.isFocused = true;
      });
    }, 100);
  }

  $scope.remove = function(data) {
    $scope.ledger.items.splice(data, 1);
  };

  $scope.$watch("ledger.items", function(newValue, oldValue) {
    $scope.totalPrice = 0;
    angular.forEach($scope.ledger.items, function(value, key) {
      if(parseFloat(value.price, 10)) {
        $scope.totalPrice += parseFloat(value.price, 10);
      }
    })
  }, true)

  $scope.submit = function() {
    $scope.loading = true;
    $scope.errorMessage = false;
    $http.post('api/ledger', $scope.ledger)
    .success(function(data) {
      $scope.loading = false;
      $location.url('/' + data.objectId);
    })
    .error(function(data) {
      $scope.loading = false;
      $scope.errorMessage = data.message || "You can try refreshing the page.";
    });
  }

  $rootScope.pages = 0;
  $rootScope.$on('$stateChangeStart', function() {
    $rootScope.pages += 1;
    if($rootScope.pages >= 2) {
      $scope.isCollapsed = true;
    }
  })
})
.controller("demoCtrl", function($scope, $http, $stateParams, $location) {
  $scope.ledger = {};
  $scope.ledger.name = "Summer BBQ at the beach";
  $scope.ledger.email = 'yourfriends@ponyup.io';
  $scope.ledger.description = "Hey guys! We're having an end of summer beach party on September 13th. I already bought all of the supplies below. I'd appreciate it if you pitch in some $$ Thanks :)";
  $scope.ledger.items = [{description: "Hamburgers and hotdogs", price: 22.56}, {description: "Drinks and ice", price: 12.56}];

  $scope.totalPrice = 0;
  angular.forEach($scope.ledger.items, function(value, key) {
    $scope.totalPrice += value.price;
  });
})
.controller("ledgerCtrl", function($rootScope, $scope, $http, $stateParams, $location, $timeout, $cookieStore) {
  // fetch the ledger info
  $http.get('/api/ledger/' + $stateParams.id)
  .success(function(body) {
    angular.element('body').animate({scrollTop: 0}, "fast");
    if(body.code !== 101) {
      $scope.ledger = body;

      // calculate the total price
      $scope.totalPrice = 0;
      angular.forEach($scope.ledger.items, function(value, key) {
        if(typeof(value.price) === "number") {
          $scope.totalPrice += value.price;
        }
        else {
          $scope.totalPrice += 0;
        }
      });

      // show edit screen if items is empty
      if(!$scope.ledger.items || $scope.ledger.items.length < 1) {
        $scope.ledger.items = [{}, {}];
        $scope.editingItems = true;
      }
    }
    else {
      $scope.error = body.error;
    }
  })
  .error(function() {

  });

  // collect money from a user
  var handler = StripeCheckout.configure({
    key: 'pk_y1vPjpvylOlQt4wnKp24cAF3nfFrN',
    token: function(token) {
      // Use the token to create the charge with a server-side script.
      // You can access the token ID with `token.id`
      console.log(token.id);
    },
    opened: function() {
      angular.element('body').addClass('overflowFix');
      angular.element('footer').addClass('hidden');
    },
    closed: function() {
      angular.element('body').removeClass('overflowFix');
      angular.element('footer').removeClass('hidden');
    }
  });

  $scope.getCC = function() {
    var hash = md5($scope.ledger.email.toLowerCase() || "");
    var defaultImage = encodeURI("http://i.imgur.com/dwL4UxC.jpg");
    console.log(hash);
    if(!$scope.ledger.email) {
      $scope.ownerError = "The owner hasn't entered their email yet. If this is your listing, please claim it using the box at the top of the page.";
      return;
    }
    handler.open({
      name: $scope.ledger.email,
      description: $scope.ledger.name,
      amount: $scope.ledger.dollarAmount * 100,
      image: "https://www.gravatar.com/avatar/" + hash + "?d=" + defaultImage
    });
  }

  // update ledger information
  $scope.submit = function() {
    $scope.loading = true;
    $scope.errorMessage = false;
    $http.post('api/ledger/update', $scope.ledger)
    .success(function(data) {
      $scope.loading = false;
      $scope.ledger = data;
      if($scope.ledger.email && $scope.ownerError) {
        $scope.ownerError = undefined;
      }

      // show edit screen if items is empty
      if(!$scope.ledger.items || $scope.ledger.items.length < 1) {
        $scope.ledger.items = [{}];
        $scope.editingItems = true;
      }
    })
    .error(function(data) {
      $scope.loading = false;
      $scope.errorMessage = data.message || "You can try refreshing the page.";
    });
  }

  // edit line-items
  $scope.editingItems = false;

  $scope.makeCopy = function(data) {
    $cookieStore.put('itemsCopy', data);
  };

  $scope.cancelEditItems = function() {
    $scope.ledger.items = $cookieStore.get('itemsCopy');
    $cookieStore.remove('itemsCopy');

    // show at least one line-item
    if(!$scope.ledger.items || $scope.ledger.items.length < 1) {
      $scope.ledger.items = [{}];
    }
  }

  $scope.add = function() {
    $scope.isFocused = false;
    $scope.ledger.items.push({});
    setTimeout(function() {
      $scope.$apply(function() {
        var name = "#item" + ($scope.ledger.items.length - 1);
        angular.element(name).focus();
        $scope.isFocused = true;
      });
    }, 100);
  }

  $scope.remove = function(data) {
    $scope.ledger.items.splice(data, 1);
  };

  $scope.$watch("ledger.items", function(newValue, oldValue) {
    $scope.totalPrice = 0;
    angular.forEach($scope.ledger.items, function(value, key) {
      if(parseFloat(value.price, 10)) {
        $scope.totalPrice += parseFloat(value.price, 10);
      }
    })
  }, true)
})
.filter('url', function ($sce) {
  return function (text) {
    return text?text.replace(/ /g, '-'):'';
  };
})
.filter('unsafe', function($sce) {
  return function(val) {
    return $sce.trustAsHtml(val);
  };
})
.directive('format', ['$filter', function ($filter) {
  return {
    require: '?ngModel',
    link: function (scope, elem, attrs, ctrl) {
      if (!ctrl) return;

      ctrl.$formatters.unshift(function (a) {
        return $filter(attrs.format)(ctrl.$modelValue)
      });

      ctrl.$parsers.unshift(function (viewValue) {
        var plainNumber = viewValue.replace(/[^\d|\-+|\.+]/g, '');
        elem.val($filter('number')(plainNumber));
        return plainNumber;
      });
    }
  };
}])
.directive('syncFocusWith', function($timeout, $rootScope) {
  return {
    restrict: 'A',
    scope: {
      focusValue: "=syncFocusWith"
    },
    link: function($scope, $element, attrs) {
      $scope.$watch("focusValue", function(currentValue, previousValue) {
        if (currentValue === true && !previousValue) {
          $element[0].focus();
        } else if (currentValue === false && previousValue) {
          $element[0].blur();
        }
      })
    }
  }
})
.directive('focusFirst', function() {
  return {
    restrict: 'A',
    link: function($scope,elem,attrs) {
      elem.bind('keydown', function(e) {
        var code = e.keyCode || e.which;
        if (code === 13) {
          e.preventDefault();
          angular.element('#item0').focus();
        }
      });
    }
  }
})
.directive('focus', function() {
  return {
    restrict: 'A',
    link: function($scope,elem,attrs) {
      elem.bind('keydown', function(e) {
        var code = e.keyCode || e.which;
        if (code === 13) {
          e.preventDefault();
          angular.element("#" + attrs.focus).focus();
        }
      });
    }
  }
})
.directive('selectOnClick', function () {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      element.on('click', function () {
        this.select();
      });
    }
  };
})
.directive('decimalPlaces', function() {
  return {
    link:function($scope, $element, attrs){
      $element.bind('keypress',function(e){
        var newVal=$element.val()+(e.charCode!==0?String.fromCharCode(e.charCode):'');
        if($element.val().search(/(.*)\.[0-9][0-9]/)===0 && newVal.length>$element.val().length){
          e.preventDefault();
        }
        var temp = $element.val().toString();

        if($element.val() > 9999.99) {
          e.preventDefault();
        }
      });
    }
  };
});