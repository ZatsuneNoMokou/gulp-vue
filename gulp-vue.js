const path = require('path'),
	through = require('through2'),
	compiler = require('vue-template-compiler'),
	pug = require('pug'),
	umd = require('umd'),
	templateEs2015 = require('vue-template-es2015-compiler'),
	PluginError = require('plugin-error'),



	PLUGIN_NAME = 'gulp-vue'
;





/**
 *
 * @param {string|function} fn
 */
function transpile(fn) {
	return templateEs2015(`function r(){${typeof fn === 'function'? fn.toString() : fn}}`, {
		stripWith: true
	})
}
function compileVue(inputText, options) {
	let vueComponent = compiler.parseComponent(inputText),
		content
	;



	if (vueComponent.errors.length > 0) {
		throw vueComponent.errors;
	}

	if (Array.isArray(vueComponent.customBlocks) && vueComponent.customBlocks.length > 0) {
		throw 'Unknown unsupported tag(s) present';
	}

	if (vueComponent.styles !== null && Array.isArray(vueComponent.styles)) {
		const filteredStyles = vueComponent.styles.filter(item => {
			return item.content.trim().length > 0
		});

		if (filteredStyles.length > 0) {
			console.warn('Style tag not supported');
		}
	}



	if (vueComponent.template !== null) {
		let lang = 'html';
		if (!!vueComponent.template.attrs && !!vueComponent.template.attrs.lang) {
			if (vueComponent.template.attrs.lang !== 'pug' && vueComponent.template.attrs.lang !== 'html') {
				throw `Unsupported template language "${vueComponent.template.attrs.lang}"`
			}

			lang = vueComponent.template.attrs.lang;
		}

		if (lang === 'pug') {
			inputText = pug.compile(vueComponent.template.content)();
		} else {
			inputText = vueComponent.template.content;
		}
	}



	if (vueComponent.script !== null) {
		let lang = 'js';

		if (!!vueComponent.script.attrs && !!vueComponent.script.attrs.lang) {
			if (/*vueComponent.script.attrs.lang !== 'ts' &&*/ vueComponent.script.attrs.lang !== 'js') {
				throw `Unsupported script language "${vueComponent.script.attrs.lang}"`
			}

			lang = vueComponent.script.attrs.lang;
		}


		content = vueComponent.script.content;
		/*if (lang === 'ts') {
			content = tsCompiler.compileString(content, {}, {}, err => {
				console.error(err.messageText, `${err.file.text.substring(err.start, err.start + err.length)}`);
				new PluginError(PLUGIN_NAME, err);
			});
		}*/
	}
	if (content === undefined) {
		content = `\texport default ${JSON.stringify({
			name: options.outputName
		})}`;
	}



	const compiledData = options.compiler.compile(inputText, options.compilerOptions),
		staticRenderFns = (Array.isArray(compiledData.staticRenderFns))? compiledData.staticRenderFns.map(transpile) : []
	;

	if (!content.includes('render:') && !content.includes('staticRenderFns:')) {
		content = content.replace(
			/export default[^{]*{/,
			`return {\n	"render": ${transpile(compiledData.render)},\n	"staticRenderFns": [\n\t\t${staticRenderFns.join(',\n\t')}\n\t],`
		);
	}

	return content;
}



function gulpVue(opt) {
	function replaceExtension(path) {
		return path.replace(/\.vue$/, '.js');
	}
	function capitalize(str) {
		return str.charAt(0).toUpperCase() + str.slice(1)
	}



	function transform(file, enc, cb) {
		if (file.isNull()) {
			return cb(null, file);
		}
		if (file.isStream()) {
			return cb(new PluginError(PLUGIN_NAME, 'Streaming not supported'));
		}



		const options = Object.assign({
			compiler,
			compilerOptions: {},
			outputName: path.basename(file.path, path.extname(file.path))
		}, opt);



		let data;
		try {
			data = umd(capitalize(options.outputName), compileVue(file.contents.toString('utf8'), options));
		} catch (err) {
			return cb(new PluginError(PLUGIN_NAME, err));
		}



		file.contents = Buffer.from(data);
		file.path = replaceExtension(file.path);
		cb(null, file);
	}

	return through.obj(transform);
}





// Exporting the plugin main function
module.exports = gulpVue;