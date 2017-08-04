module.exports = function(grunt) {
  grunt.initConfig({
    "html-inspector":{
      all:{src:["*.html"]}
    },
    csslint:{
      all:{src:["css/*.css"]}
    },
    jshint:{
      all:["js/*.js"]
    }
  });
  
  grunt.loadNpmTasks('grunt-html-inspector');
  grunt.loadNpmTasks('grunt-contrib-csslint');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.registerTask("check",["html-inspector","csslint","jshint"]);

};