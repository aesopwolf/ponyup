var app = angular.module('app', [
  'ui.router',
  'ui.bootstrap',
  'ngAnimate',
  'ngFitText',
  'angular-loading-bar'
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
    .state('cause', {
      url: '/cause',
      templateUrl: 'partials/cause.html',
      controller: 'causeCtrl'
    })
    .state('demo', {
      url: '/demo',
      templateUrl: 'partials/demo.html',
      controller: 'demoCtrl'
    })
    .state('demo.active', {
      templateUrl: 'partials/cause.html',
      controller: 'causeCtrl'
    });
})
.run(function($location) {

})
.controller("demoCtrl", function($state) {
  $state.go('demo.active');
})
.controller("causeCtrl", function($scope, $modal) {
  var handler = StripeCheckout.configure({
    key: 'pk_test_854lbQWakbhRqcBFPcjRfXfx',
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
    handler.open({
      name: 'Sarah Fox',
      description: 'Kimberly\'s Surprise Birthday BBQ',
      amount: $scope.dollarAmount * 100
    });
  }
})
.controller("mainCtrl", function($rootScope, $scope, $http, $location) {
  // hide the navigation bar for certain pages
  $scope.hidden = true;
  $rootScope.$on('$stateChangeSuccess', function() {
    if($location.path() == '/cause' || $location.path() == '/demo') {
      angular.element('.navbar-wrapper').addClass('hidden');
    }
    else {
      angular.element('.navbar-wrapper').removeClass('hidden');
      $scope.hidden = false;
    }
  });

  $scope.cause = {};
  $scope.cause.lineItems = [{placeholder: "Pizza", placeholderPrice: "$20"}, {placeholder: "Soda", placeholderPrice: "$5"}];
  $scope.totalPrice = 0;
  $scope.isFocused = false;
  $scope.isCollapsed = true;
  $scope.loading = false;

  $scope.add = function() {
    $scope.isFocused = false;
    $scope.cause.lineItems.push({});
    setTimeout(function() {
      $scope.$apply(function() {
        $scope.isFocused = true;
      });
    }, 100);
  }

  $scope.remove = function(data) {
    $scope.cause.lineItems.splice(data, 1);
  };

  $scope.$watch("cause.lineItems", function(newValue, oldValue) {
    $scope.totalPrice = 0;
    angular.forEach($scope.cause.lineItems, function(value, key) {
      if(parseFloat(value.price, 10)) {
        $scope.totalPrice += parseFloat(value.price, 10);
      }
    })
  }, true)

  $scope.submit = function() {
    $scope.loading = true;
    $scope.errorMessage = false;
    $http.post('api/cause', $scope.cause)
    .success(function(data) {
      $scope.loading = false;
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
.filter('url', function ($sce) {
  return function (text) {
    return text?text.replace(/ /g, '-'):'';
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