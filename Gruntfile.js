module.exports = function(grunt) {
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-umd-wrapper');
  
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    clean: [ 'build' ],
    umd_wrapper: {
      qed: {
        files: {'build/qed.js': 'src/main.js'}
      }
    },
    uglify: {
      options: {
        compress: {},//false,
        banner: '/*! <%= pkg.name %> <%= pkg.version %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src:  'build/<%= pkg.name %>.js',
        dest: 'build/<%= pkg.name %>.min.js'
      }
    },
    concat: {
      all: {
        src: ['lib/MutationObserver.js', 'lib/marked.js', 'build/qed.js'],
        dest: 'build/qed-all.js',
      },
      'all-min': {
        src: ['lib/MutationObserver.min.js', 'lib/marked.min.js', 'build/qed.min.js'],
        dest: 'build/qed-all.min.js',
      },
      // do not include marked.js (include only MutationObserver.js polyfill) 
      core: {
        src: ['lib/MutationObserver.js', 'build/qed.js'],
        dest: 'build/qed-core.js',
      },
      'core-min': {
        src: ['lib/MutationObserver.min.js', 'build/qed.min.js'],
        dest: 'build/qed-core.min.js'
      }
    }
  });

  // Default task(s).
  grunt.registerTask('default', ['umd_wrapper', 'uglify', 'concat:core', 'concat:core-min', 'concat:all', 'concat:all-min']);

};
