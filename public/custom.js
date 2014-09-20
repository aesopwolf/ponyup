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
      templateUrl: '/partials/index.html',
    })
    .state('privacy', {
      url: '/privacy',
      templateUrl: '/partials/privacy.html'
    })
    .state('tos', {
      url: '/terms',
      templateUrl: '/partials/tos.html'
    })
    .state('demo', {
      url: '/demo',
      templateUrl: '/partials/demo.html',
      controller: 'demoCtrlForward'
    })
    .state('demo.active', {
      templateUrl: '/partials/ledger.html',
      controller: 'demoCtrl'
    })
    .state('pricing', {
      url: '/pricing',
      templateUrl: '/partials/pricing.html'
    })
    .state('ledgerEdit', {
      url: "/{id:[A-Za-z0-9]{10}}/edit",
      templateUrl: '/partials/ledgerEdit.html',
      controller: 'ledgerCtrl'
    })
    .state('ledgerTransfer', {
      url: "/{id:[A-Za-z0-9]{10}}/transfer",
      templateUrl: '/partials/ledgerTransfer.html',
      controller: 'ledgerTransferCtrl'
    })
    .state('ledger', {
      url: "/{id:[A-Za-z0-9]{10}}",
      templateUrl: '/partials/ledger.html',
      controller: 'ledgerCtrl'
    });
})
.run(function(editableOptions, $cookies, $http) {
  editableOptions.theme = 'bs3'; // for xeditable
  // $http.defaults.xsrfCookieName = 'ponyup.csrf';
  // $http.defaults.xsrfHeaderName = 'x-csrf-token';
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
.controller("mainCtrl", function($rootScope, $scope, $http, $location, $timeout, $state, $cookies) {
  // scroll to top of page
  $rootScope.$on('$stateChangeStart',  function() {
    angular.element('body').animate({scrollTop: 0}, "fast");
  });

  // logout function
  // todo: setup csrf here
  $rootScope.logOut = function() {
    var csrf = $cookies.undefined;
    $http.post('/api/logout', {'_csrf': 'test'})
    .success(function(data) {
      if(data.status === 'error') {
        $scope.errorMessage = data.message;
      }
      else {
        $scope.ledger.admin = false;
        $location.url('/' + $scope.ledger.objectId);
      }
    })
    .error(function(data) {
      $scope.loading = false;
      $scope.errorMessage = data.message || "You can try refreshing the page.";
    });
  };

  // get payments made on a listing
  $rootScope.fetchPayments = function(id, cb) {
    $http.get('/api/ledger/' + id + "/charges")
    .success(function(body) {
      if(body.code !== 101) {
        cb(body.results);
      }
      else {
        $scope.error = body.error;
      }
    })
    .error(function() {

    });
  }

  // set default data
  $scope.ledger = {};
  $scope.ledger.items = [{placeholder: "Pizza", placeholderPrice: "$40"}, {placeholder: "Drinks", placeholderPrice: "$12"}];
  $scope.totalPrice = 0;
  $scope.isFocused = false;
  $scope.isCollapsed = true;
  $scope.loading = false;

  // update total price of items the user has entered
  $scope.$watch("ledger.items", function(newValue, oldValue) {
    $scope.totalPrice = 0;
    angular.forEach($scope.ledger.items, function(value, key) {
      if(parseFloat(value.price, 10)) {
        $scope.totalPrice += parseFloat(value.price, 10);
      }
    })
  }, true)

  // show typing in real time (for the demo animation)
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

  // animate a really cool interactive demo!
  $scope.demo = function() {
    if($rootScope.isDemoPlaying) {
      // in case people click the button twice in a row
      return
    };
    if($location.path() !== '/') {
      $state.go('home');
    }
    $rootScope.isDemoPlaying = true;
    $scope.ledger.name = '';
    $scope.ledger.items = [{}, {}];

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
    angular.element('.fakeMouse').remove();
    if($location.path() == '/') {
      $scope.home = true;
      $scope.ledger = {};
      $scope.ledger.name = '';
      $scope.ledger.items = [{placeholder: "Pizza", placeholderPrice: "$40"}, {placeholder: "Drinks", placeholderPrice: "$12"}];
    }

    if($location.path() === '/demo' || $location.path().split('').length >= 11) {
      angular.element('.navbar-wrapper').addClass('hidden');
    }
    else {
      angular.element('.navbar-wrapper').removeClass('hidden');
      $scope.hidden = false;
    }
  });

  // add new line-item
  $scope.add = function() {
    $scope.isFocused = false;
    $scope.ledger.items.push({});

    // todo: research $q
    $timeout(function() {
      $scope.isFocused = true;
    }, 100, true);
  }

  // remove line-item
  $scope.remove = function(data) {
    $scope.ledger.items.splice(data, 1);
  };

  // save the form to parse
  $scope.submit = function() {
    if($location.path() !== "/") {
      return
    }

    $scope.loading = true;
    $scope.errorMessage = false;

    // remove placeholder data
    angular.forEach($scope.ledger.items, function(value, key) {
      value.placeholder = undefined;
      value.placeholderPrice = undefined;
    });

    // finally submit the data to the server
    $http.post('/api/ledger', $scope.ledger)
    .success(function(data) {
      $scope.loading = false;
      $location.url('/' + data.objectId);
    })
    .error(function(data) {
      $scope.loading = false;
      $scope.errorMessage = data.message || "You can try refreshing the page.";
    });
  }

  // what is this?
  // $rootScope.pages = 0;
  // $rootScope.$on('$stateChangeStart', function() {
  //   $rootScope.pages += 1;
  //   if($rootScope.pages >= 2) {
  //     $scope.isCollapsed = true;
  //   }
  // })
})
.controller("demoCtrl", function($scope, $http, $stateParams, $location) {
  $scope.ledger = {};
  $scope.ledger.objectId = 'demo';
  $scope.ledger.name = "Summer BBQ at the beach";
  $scope.ledger.email = 'yourfriends@ponyup.io';
  $scope.ledger.description = "You can send your friends directly to this page so they can pay you. They can also see how much money other people have pitched in.";
  $scope.ledger.items = [{description: "Hamburgers and hotdogs", price: 22.56}, {description: "Drinks and ice", price: 12.56}];
  $scope.ledger.contributions = [
    {
      "cardBrand": "Visa",
      "amount": 700,
      "created": 1410485457
    },
    {
      "cardBrand": "Mastercard",
      "amount": 400,
      "created": 1410755533
    },
    {
      "cardBrand": "Discover",
      "amount": 500,
      "created": 1410753208
    },
    {
      "cardBrand": "Visa",
      "amount": 600,
      "created": 1410754366
    }
  ];

  $scope.totalPrice = 0;
  angular.forEach($scope.ledger.items, function(value, key) {
    $scope.totalPrice += value.price;
  });

  $scope.totalContributions = 0;
  angular.forEach($scope.ledger.contributions, function(value, key) {
    $scope.totalContributions += (value["amount"] / 100);
  });

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
.controller("ledgerCtrl", function($rootScope, $scope, $http, $stateParams, $location, $timeout, $cookieStore, $cookies) {
  // fetch the ledger info
  $http.get('/api/ledger/' + $stateParams.id)
  .success(function(body) {
    // angular.element('body').animate({scrollTop: 0}, "fast");
    if(body.code !== 101) {
      $scope.ledger = body;
      $rootScope.fetchPayments($scope.ledger.objectId, function(data) {
        $scope.ledger.contributions = data;

        // calculate the contributions made
        $scope.totalContributions = 0;
        angular.forEach($scope.ledger.contributions, function(key, value) {
          $scope.totalContributions += (key.amount / 100);
        });
      });

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
  var stripeKey = $location.host() === 'ponyip.io' ? 'pk_iQ9f8PrbR8se0IfGjmdw43iwxzGbr' : 'pk_y1vPjpvylOlQt4wnKp24cAF3nfFrN';
  var handler = StripeCheckout.configure({
    key: stripeKey,
    token: function(token) {
      token.amount = $scope.ledger.dollarAmount * 100;
      token.description = $scope.ledger.name;
      token.objectId = $scope.ledger.objectId;

      $http.post('/api/charge', token)
      .success(function(data) {
        // add payment info to contributions list
        data.message.cardBrand = data.message.card.brand.toLowerCase();
        $scope.ledger.contributions.push(data.message)
        $scope.ledger.dollarAmount = undefined;

        // add up total contributions
        $scope.totalContributions = 0;
        angular.forEach($scope.ledger.contributions, function(value, key) {
          if(typeof(value.amount) === "number") {
            $scope.totalContributions += (value.amount  / 100);
          }
          else {
            $scope.totalContributions += 0;
          }
        });

        if(data.status == 'error') {
          $scope.chargeError = data.message;
        }
      })
      .error(function(data) {
        $scope.chargeError = data;
      });
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
    $scope.chargeError = undefined;
  };

  // update ledger information ('name', 'items', 'description')
  $scope.submit = function() {
    $scope.loading = true;
    $scope.errorMessage = undefined;
    $http.post('/api/ledger/update', $scope.ledger)
    .success(function(data) {
      $scope.loading = false;
      if(data.status === 'error') {
        $scope.errorMessage = data.message;
      }
      else {
        $scope.ledger = data;
        if($scope.ledger.email && $scope.ownerError) {
          $scope.ownerError = undefined;
        }

        // show edit screen if items is empty
        if(!$scope.ledger.items || $scope.ledger.items.length < 1) {
          $scope.ledger.items = [{}];
          $scope.editingItems = true;
        }
      }
    })
    .error(function(data) {
      $scope.loading = false;
      $scope.errorMessage = data.message || "You can try refreshing the page.";
    });
  };

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

  $scope.removeError = function() {
    $timeout(function() {
      $scope.errorMessage = undefined;
    }, 10, true);
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
.controller("ledgerTransferCtrl", function($rootScope, $scope, $http, $stateParams, $location, $timeout, $cookieStore, $cookies) {
  // fetch the ledger info
  $http.get('/api/ledger/' + $stateParams.id)
  .success(function(body) {
    if(body.code !== 101) {
      $scope.ledger = body;

      // get the payments made so far
      $rootScope.fetchPayments($scope.ledger.objectId, function(data) {
        $scope.ledger.contributions = data;

        // calculate the contributions made
        $scope.totalContributions = 0;
        $scope.totalContributionsWithFee = 0;
        angular.forEach($scope.ledger.contributions, function(key, value) {
          $scope.totalContributions += (key.amount / 100);

          // calculate the fees
          key.withFee = ((key.amount  * 0.97) - 30);
          $scope.totalContributionsWithFee += (key.withFee / 100);
        });

        $scope.requestingDeposit = false;
      });
    }
    else {
      $scope.error = body.error;
    }
  })
  .error(function() {

  });

  // deposit money into owners account
  var stripeKey = $location.host() === 'ponyip.io' ? 'pk_iQ9f8PrbR8se0IfGjmdw43iwxzGbr' : 'pk_y1vPjpvylOlQt4wnKp24cAF3nfFrN';
  var depositHandler = StripeCheckout.configure({
    key: stripeKey,
    panelLabel: 'Deposit {{amount}}',
    token: function(token) {
      $scope.requestingDeposit = undefined;
      token.amountToDeposit = $scope.totalContributionsWithFee * 100;
      token.objectId = $scope.ledger.objectId;
      token.legalName = $scope.legalName;
      token.depositorType = $scope.depositorType;

      $scope.depositError = undefined;
      $http.post('/api/deposit', token)
      .success(function(data) {
        // add deposit info to transfer list
        // $scope.ledger.deposits.push(data.message)

        // // add up total deposits
        // $scope.totalDeposits = 0;
        // angular.forEach($scope.ledger.deposits, function(value, key) {
        //   if(typeof(value.amount) === "number") {
        //     $scope.totalDeposits += (value.amount  / 100);
        //   }
        //   else {
        //     $scope.totalDeposits += 0;
        //   }
        // });

        if(data.status === 'error') {
          $scope.depositError = data.message + " Try again...";
          $timeout(function() {
            $scope.requestingDeposit = true;
            $scope.requestingDepositDone = false;
          }, 100, true);
        }
        else if(!data.verified) {
          var verifyMethod = $scope.depositorType == 'individual'? 'SSN' : 'EIN';
          $scope.requestingDeposit = undefined;
          $scope.needVerification = data;
          $scope.verifyError = "Last step! We need to verify your debit card using your " + verifyMethod;
        }
      })
      .error(function(data) {
        $scope.depositError = data || 'There was an unknown error. Refresh the page and try again';
      });
    },
    opened: function() {
      angular.element('body').addClass('overflowFix');
      angular.element('footer').addClass('hidden');
    },
    closed: function() {
      $scope.requestingDeposit = false;
      angular.element('body').removeClass('overflowFix');
      angular.element('footer').removeClass('hidden');
    }
  });

  $scope.getDepositCC = function(legalName, depositorType) {
    $scope.requestingDeposit = false;
    $scope.legalName = legalName;
    $scope.depositorType = depositorType;
    var hash = md5($scope.ledger.email.toLowerCase() || "");
    var defaultImage = encodeURI("http://i.imgur.com/dwL4UxC.jpg");
    depositHandler.open({
      email: $scope.ledger.email,
      name: legalName,
      description: "Enter your debit card information",
      amount: $scope.totalContributionsWithFee * 100,
      image: "https://www.gravatar.com/avatar/" + hash + "?d=" + defaultImage
    });
    $scope.depositError = undefined;
  };

  $scope.verify = function(verification) {
    $scope.requestingDeposit = false;
    $http.post('/api/verify', verification)
      .success(function(data) {
        $scope.verifyError = undefined;
        $scope.depositError = undefined;
        $scope.requestingDeposit = false;
        if(data.status === 'success') {
          $scope.needVerification = undefined;
          $scope.transferSuccess = 'Success! Your money transfer is complete.';
        }
        else if(data.status == 'error') {
          $scope.verifyError = data.message;
        }
      })
      .error(function(data) {
        $scope.verifyError = data;
      });
  };
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