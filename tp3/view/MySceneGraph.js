import { CGFappearance, CGFXMLreader, CGFtexture, CGFcamera, CGFcameraOrtho } from '../../lib/CGF.js';
import { MyCylinder } from './primitives/MyCylinder.js';
import { MyRectangle } from './primitives/MyRectangle.js';
import { MySphere } from './primitives/MySphere.js';
import { MyTorus } from './primitives/MyTorus.js';
import { MyTriangle } from './primitives/MyTriangle.js';
import { MyPatch } from './primitives/MyPatch.js';
import { MyKeyframeAnimation } from './animations/MyKeyframeAnimation.js';
import { MyKeyframe } from './animations/MyKeyframe.js';
import { MyTextureInfo } from './records/MyTextureInfo.js';
import { MyHighlightInfo } from './records/MyHighlightInfo.js';
import { MyComponent } from './MyComponent.js';

let START_BOARD = await (await fetch('boards/startBoard.json')).json();

var DEGREE_TO_RAD = Math.PI / 180;

// Order of the groups in the XML document.
var SCENE_INDEX = 0;
var VIEWS_INDEX = 1;
var AMBIENT_INDEX = 2;
var LIGHTS_INDEX = 3;
var TEXTURES_INDEX = 4;
var MATERIALS_INDEX = 5;
var TRANSFORMATIONS_INDEX = 6;
var PRIMITIVES_INDEX = 7;
var ANIMATIONS_INDEX = 8;
var COMPONENTS_INDEX = 9;

/**
 * MySceneGraph class, representing the scene graph.
 */
export class MySceneGraph {
    /**
     * @constructor
     */
    constructor(filename, scene) {
        this.loadedOk = null;

        // Establish bidirectional references between scene and graph.
        this.scene = scene;
        scene.graph = this;

        this.nodes = [];

        this.appearances = [];

        this.idRoot = null;                    // The id of the root element.

        this.materialIndex = 0;

        this.axisCoords = [];
        this.axisCoords['x'] = [1, 0, 0];
        this.axisCoords['y'] = [0, 1, 0];
        this.axisCoords['z'] = [0, 0, 1];

        this.board = null;

        // File reading 
        this.reader = new CGFXMLreader();

        /*
         * Read the contents of the xml file, and refer to this class for loading and error handlers.
         * After the file is read, the reader calls onXMLReady on this object.
         * If any error occurs, the reader calls onXMLError on this object, with an error message
         */
        this.reader.open('scenes/' + filename, this);
    }

    /*
     * Callback to be executed after successful reading
     */
    onXMLReady() {
        this.log("XML Loading finished.");
        var rootElement = this.reader.xmlDoc.documentElement;

        // Here should go the calls for different functions to parse the various blocks
        var error = this.parseXMLFile(rootElement);

        if (error == null) {
            error = this.checkSceneGraphCycles();
        }

        if (error != null) {
            this.onXMLError(error);
            return;
        }

        this.loadedOk = true;

        // As the graph loaded ok, signal the scene so that any additional initialization depending on the graph can take place
        this.scene.onGraphLoaded();        
    }

    /**
     * Utility for checking cyclic references in the scene graph.
     * @param {string} cid
     * @param {object} visited
     * @param {object} recStack
     */
    isCyclicUtil(cid, visited, recStack) {
        if (recStack[cid]) return true;

        if (visited[cid]) return false;

        visited[cid] = true;

        recStack[cid] = true;

        let children = this.components[cid].componentIds;

        for (let i = 0; i < children.length; i++) {
            if (this.isCyclicUtil(children[i], visited, recStack)) {
                return true;
            }
        }

        recStack[cid] = false;

        return false;
    }

    /**
     * Checks if the scene graph has cycles.
     * @return {null} if there are no cycles, an error message otherwise
     */
    checkSceneGraphCycles() {
        let visited = [];
        let recStack = [];

        let componentNames = Object.keys(this.components);

        for (let i = 0; i < componentNames.length; i++) {
            visited[componentNames[i]] = false;
            recStack[componentNames[i]] = false;
        }

        for (let i = 0; i < componentNames.length; i++) {
            if (this.isCyclicUtil(componentNames[i], visited, recStack)) {
                return "Scene graph contains cycle";
            }
        }

        return null
    }

    /**
     * Parses the XML file, processing each block.
     * @param {XML root element} rootElement
     */
    parseXMLFile(rootElement) {
        if (rootElement.nodeName != "sxs")
            return "root tag <sxs> missing";

        var nodes = rootElement.children;

        // Reads the names of the nodes to an auxiliary buffer.
        var nodeNames = [];

        for (var i = 0; i < nodes.length; i++) {
            nodeNames.push(nodes[i].nodeName);
        }

        var error;

        // Processes each node, verifying errors.

        // <scene>
        var index;
        if ((index = nodeNames.indexOf("scene")) == -1)
            return "tag <scene> missing";
        else {
            if (index != SCENE_INDEX)
                this.onXMLMinorError("tag <scene> out of order " + index);

            //Parse scene block
            if ((error = this.parseScene(nodes[index])) != null)
                return error;
        }

        // <views>
        if ((index = nodeNames.indexOf("views")) == -1)
            return "tag <views> missing";
        else {
            if (index != VIEWS_INDEX)
                this.onXMLMinorError("tag <views> out of order");

            //Parse views block
            if ((error = this.parseView(nodes[index])) != null)
                return error;
        }

        // <ambient>
        if ((index = nodeNames.indexOf("ambient")) == -1)
            return "tag <ambient> missing";
        else {
            if (index != AMBIENT_INDEX)
                this.onXMLMinorError("tag <ambient> out of order");

            //Parse ambient block
            if ((error = this.parseAmbient(nodes[index])) != null)
                return error;
        }

        // <lights>
        if ((index = nodeNames.indexOf("lights")) == -1)
            return "tag <lights> missing";
        else {
            if (index != LIGHTS_INDEX)
                this.onXMLMinorError("tag <lights> out of order");

            //Parse lights block
            if ((error = this.parseLights(nodes[index])) != null)
                return error;
        }
        // <textures>
        if ((index = nodeNames.indexOf("textures")) == -1)
            return "tag <textures> missing";
        else {
            if (index != TEXTURES_INDEX)
                this.onXMLMinorError("tag <textures> out of order");

            //Parse textures block
            if ((error = this.parseTextures(nodes[index])) != null)
                return error;
        }

        // <materials>
        if ((index = nodeNames.indexOf("materials")) == -1)
            return "tag <materials> missing";
        else {
            if (index != MATERIALS_INDEX)
                this.onXMLMinorError("tag <materials> out of order");

            //Parse materials block
            if ((error = this.parseMaterials(nodes[index])) != null)
                return error;
        }

        // <transformations>
        if ((index = nodeNames.indexOf("transformations")) == -1)
            return "tag <transformations> missing";
        else {
            if (index != TRANSFORMATIONS_INDEX)
                this.onXMLMinorError("tag <transformations> out of order");

            //Parse transformations block
            if ((error = this.parseTransformations(nodes[index])) != null)
                return error;
        }

        // <primitives>
        if ((index = nodeNames.indexOf("primitives")) == -1)
            return "tag <primitives> missing";
        else {
            if (index != PRIMITIVES_INDEX)
                this.onXMLMinorError("tag <primitives> out of order");

            //Parse primitives block
            if ((error = this.parsePrimitives(nodes[index])) != null)
                return error;
        }

        // <components>
        if ((index = nodeNames.indexOf("animations")) == -1)
            return "tag <animations> missing";
        else {
            if (index != ANIMATIONS_INDEX)
                this.onXMLMinorError("tag <animations> out of order");

            //Parse components block
            if ((error = this.parseAnimations(nodes[index])) != null)
                return error;
        }

        // <components>
        if ((index = nodeNames.indexOf("components")) == -1)
            return "tag <components> missing";
        else {
            if (index != COMPONENTS_INDEX)
                this.onXMLMinorError("tag <components> out of order");

            //Parse components block
            if ((error = this.parseComponents(nodes[index])) != null)
                return error;
        }
        this.log("all parsed");
    }

    /**
     * Parses the <scene> block. 
     * @param {scene block element} sceneNode
     */
    parseScene(sceneNode) {

        // Get root of the scene.
        var root = this.reader.getString(sceneNode, 'root')
        if (root == null)
            return "no root defined for scene";

        this.idRoot = root;

        // Get axis length        
        var axis_length = this.reader.getFloat(sceneNode, 'axis_length');
        if (axis_length == null)
            this.onXMLMinorError("no axis_length defined for scene; assuming 'length = 1'");

        this.referenceLength = axis_length || 1;

        this.log("Parsed scene");

        return null;
    }

    /**
     * Parses the <views> block.
     * @param {view block element} viewsNode
     */
    parseView(viewsNode) {
        this.views = []

        let foundCamera = false

        for (let i = 0; i < viewsNode.children.length; i++) {

            let camera = viewsNode.children[i];
            
            if (camera.nodeName !== 'perspective' && camera.nodeName !== 'ortho') {
                this.onXMLMinorError("unknown tag <" + camera.nodeName + ">");
                continue;
            }
            

            foundCamera = true

            let cameraID = this.reader.getString(camera, 'id');

            let near = this.reader.getFloat(camera, 'near');
            if (near == null || isNaN(near)) {
                console.log('Error parsing camera ' + cameraID);
                continue;
            }

            let far = this.reader.getFloat(camera, 'far');
            if (far == null || isNaN(far)) {
                console.log('Error parsing camera ' + cameraID);
                continue;
            }

            if (camera.nodeName == 'perspective') {
                let angle = this.reader.getFloat(camera, 'angle');
                if (angle == null || isNaN(angle)) {
                    console.log('Error parsing camera ' + cameraID);
                    continue;
                }
                
                let from = vec3.fromValues(0, 0, 0);
                let to = vec3.fromValues(0, 0, 0);

                let foundFrom = false;
                let foundTo = false;

                for (let j = 0; j < camera.children.length; j++) {
                    let coords = camera.children[j];

                    if (coords.nodeName != 'from' && coords.nodeName != 'to') {
                        this.onXMLMinorError("unknown tag <" + camera.nodeName + ">");
                        continue;
                    }

                    if (coords.nodeName == 'from') {
                        foundFrom = true;
                        let x = this.reader.getFloat(coords, 'x');
                        let y = this.reader.getFloat(coords, 'y');
                        let z = this.reader.getFloat(coords, 'z');

                        if (x == null || y == null || z == null || isNaN(x) || isNaN(y) || isNaN(z)) {
                            this.onXMLMinorError('Camera ' + cameraID + 'coordinates wrong');
                            continue;
                        }

                        from = vec3.fromValues(x, y, z);
                    }

                    else if (coords.nodeName == 'to') {
                        foundTo = true;
                        let x = this.reader.getFloat(coords, 'x');
                        let y = this.reader.getFloat(coords, 'y');
                        let z = this.reader.getFloat(coords, 'z');

                        if (x == null || y == null || z == null || isNaN(x) || isNaN(y) || isNaN(z)) {
                            this.onXMLMinorError('Camera ' + cameraID + 'coordinates wrong');
                            continue;
                        }

                        to = vec3.fromValues(x, y, z);
                    }
                }

                if (foundFrom && foundTo) {
                    this.views[cameraID] = new CGFcamera(angle * (Math.PI/180), near, far, from, to);
                }
                else {
                    this.onXMLMinorError('Camera ' + cameraID + 'missing from or to');
                }
            }

            else if (camera.nodeName == 'ortho') {
                let left = this.reader.getFloat(camera, 'left');
                if (left == null || isNaN(left)) {
                    console.log('Error parsing camera ' + cameraID);
                    continue;
                }

                let right = this.reader.getFloat(camera, 'right');
                if (right == null || isNaN(right)) {
                    console.log('Error parsing camera ' + cameraID);
                    continue;
                }

                let top = this.reader.getFloat(camera, 'top');
                if (top == null || isNaN(top)) {
                    console.log('Error parsing camera ' + cameraID);
                    continue;
                }

                let bottom = this.reader.getFloat(camera, 'bottom');
                if (bottom == null || isNaN(bottom)) {
                    console.log('Error parsing camera ' + cameraID);
                    continue;
                }
                
                let from = vec3.fromValues(0, 0, 0);
                let to = vec3.fromValues(0, 0, 0);
                let up = vec3.fromValues(0, 1, 0);

                let foundFrom = false;
                let foundTo = false;

                for (let j = 0; j < camera.children.length; j++) {
                    let coords = camera.children[j];

                    if (coords.nodeName != 'from' && coords.nodeName != 'to' && coords.nodeName != 'up') {
                        this.onXMLMinorError("unknown tag <" + camera.nodeName + ">");
                        continue;
                    }

                    if (coords.nodeName == 'from') {
                        foundFrom = true;
                        let x = this.reader.getFloat(coords, 'x');
                        let y = this.reader.getFloat(coords, 'y');
                        let z = this.reader.getFloat(coords, 'z');

                        if (x == null || y == null || z == null || isNaN(x) || isNaN(y) || isNaN(z)) {
                            this.onXMLError('Camera ' + cameraID + 'coordinates wrong');
                            continue;
                        }

                        from = vec3.fromValues(x, y, z);
                    }

                    else if (coords.nodeName == 'to') {
                        foundTo = true;
                        let x = this.reader.getFloat(coords, 'x');
                        let y = this.reader.getFloat(coords, 'y');
                        let z = this.reader.getFloat(coords, 'z');

                        if (x == null || y == null || z == null || isNaN(x) || isNaN(y) || isNaN(z)) {
                            this.onXMLError('Camera ' + cameraID + 'coordinates wrong');
                            continue;
                        }

                        to = vec3.fromValues(x, y, z);
                    }

                    else if (coords.nodeName == 'up') {
                        let x = this.reader.getFloat(coords, 'x');
                        let y = this.reader.getFloat(coords, 'y');
                        let z = this.reader.getFloat(coords, 'z');

                        if (x == null || y == null || z == null || isNaN(x) || isNaN(y) || isNaN(z)) {
                            this.onXMLError('Camera ' + cameraID + 'coordinates wrong');
                            continue;
                        }

                        up = vec3.fromValues(x, y, z);
                    }
                }

                if (foundFrom && foundTo) {
                    this.views[cameraID] = new CGFcameraOrtho(left, right, bottom, top, near, far, from, to, up);
                }
                else {
                    this.onXMLMinorError('Camera ' + cameraID + 'missing from or to');
                }
            }
            
        }

        if (!foundCamera) {
            this.onXMLError('No cameras in scene');
        }

        this.selectedCamera = this.reader.getString(viewsNode, 'default');

        if (this.selectedCamera == null) {
            this.onXMLError('No default camera');
        }

        this.log('Parsed cameras');

        return null;
    }

    /**
     * Parses the <ambient> node.
     * @param {ambient block element} ambientsNode
     */
    parseAmbient(ambientsNode) {

        var children = ambientsNode.children;

        this.ambient = [];
        this.background = [];

        var nodeNames = [];

        for (var i = 0; i < children.length; i++)
            nodeNames.push(children[i].nodeName);

        var ambientIndex = nodeNames.indexOf("ambient");
        var backgroundIndex = nodeNames.indexOf("background");

        var color = this.parseColor(children[ambientIndex], "ambient");
        if (!Array.isArray(color))
            return color;
        else
            this.ambient = color;

        color = this.parseColor(children[backgroundIndex], "background");
        if (!Array.isArray(color))
            return color;
        else
            this.background = color;

        this.log("Parsed ambient");

        return null;
    }

    /**
     * Parses the <light> node.
     * @param {lights block element} lightsNode
     */
    parseLights(lightsNode) {
        var children = lightsNode.children;

        this.lights = [];
        var numLights = 0;

        var grandChildren = [];
        var nodeNames = [];

        // Any number of lights.
        for (var i = 0; i < children.length; i++) {

            // Storing light information
            var global = [];
            var attributeNames = [];
            var attributeTypes = [];

            //Check type of light
            if (children[i].nodeName != "omni" && children[i].nodeName != "spot") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }
            else {
                attributeNames.push(...["location", "ambient", "diffuse", "specular", "attenuation"]);
                attributeTypes.push(...["position", "color", "color", "color", "attenuation"]);
            }

            // Get id of the current light.
            var lightId = this.reader.getString(children[i], 'id');
            if (lightId == null)
                return "no ID defined for light";

            // Checks for repeated IDs.
            if (this.lights[lightId] != null)
                return "ID must be unique for each light (conflict: ID = " + lightId + ")";

            // Light enable/disable
            var enableLight = true;
            var aux = this.reader.getBoolean(children[i], 'enabled');
            if (!(aux != null && !isNaN(aux) && (aux == true || aux == false)))
                this.onXMLMinorError("unable to parse value component of the 'enable light' field for ID = " + lightId + "; assuming 'value = 1'");

            enableLight = aux || false;

            //Add enabled boolean and type name to light info
            global.push(enableLight);
            global.push(children[i].nodeName);

            grandChildren = children[i].children;
            // Specifications for the current light.

            nodeNames = [];
            for (var j = 0; j < grandChildren.length; j++) {
                nodeNames.push(grandChildren[j].nodeName);
            }

            for (var j = 0; j < attributeNames.length; j++) {
                var attributeIndex = nodeNames.indexOf(attributeNames[j]);

                if (attributeIndex != -1) {
                    if (attributeTypes[j] == "position")
                        var aux = this.parseCoordinates4D(grandChildren[attributeIndex], "light position for ID" + lightId);
                    else if(attributeTypes[j] == "color")
                        var aux = this.parseColor(grandChildren[attributeIndex], attributeNames[j] + " illumination for ID" + lightId);
                    else{ //target in spot
                        var constant = this.reader.getFloat(grandChildren[attributeIndex], 'constant')
                        if (!(constant != null && !isNaN(constant)))
                            return "unable to parse constant attenuation of the light for ID = " + lightId;

                        var linear = this.reader.getFloat(grandChildren[attributeIndex], 'linear')
                        if (!(linear != null && !isNaN(linear)))
                            return "unable to parse linear attenuation of the light for ID = " + lightId;

                        var quadratic = this.reader.getFloat(grandChildren[attributeIndex], 'quadratic')
                        if (!(quadratic != null && !isNaN(quadratic)))
                            return "unable to parse quadratic attenuation of the light for ID = " + lightId;

                        if((constant && linear) || (constant && quadratic) || (linear && quadratic))
                            return "only one attenuation value can be 1 in the light with ID = " + lightId;
                        if(constant != 1 && linear != 1 && quadratic != 1)
                            return "one attenuation value needs to be 1 in the light with ID = " + lightId;

                        var aux = [constant, linear, quadratic];
                    }

                    if (!Array.isArray(aux))
                        return aux;

                    global.push(aux);
                }
                else
                    return "light " + attributeNames[i] + " undefined for ID = " + lightId;
            }

            // Gets the additional attributes of the spot light
            if (children[i].nodeName == "spot") {
                var angle = this.reader.getFloat(children[i], 'angle');
                if (!(angle != null && !isNaN(angle)))
                    return "unable to parse angle of the light for ID = " + lightId;

                var exponent = this.reader.getFloat(children[i], 'exponent');
                if (!(exponent != null && !isNaN(exponent)))
                    return "unable to parse exponent of the light for ID = " + lightId;

                var targetIndex = nodeNames.indexOf("target");

                // Retrieves the light target.
                var targetLight = [];
                if (targetIndex != -1) {
                    var aux = this.parseCoordinates3D(grandChildren[targetIndex], "target light for ID " + lightId);
                    if (!Array.isArray(aux))
                        return aux;

                    targetLight = aux;
                }
                else
                    return "light target undefined for ID = " + lightId;
                    
                global.push(...[angle, exponent, targetLight])
            }

            this.lights[lightId] = global;
            numLights++;
        }

        if (numLights == 0)
            return "at least one light must be defined";
        else if (numLights > 8)
            this.onXMLMinorError("too many lights defined; WebGL imposes a limit of 8 lights");

        this.log("Parsed lights");
        return null;
    }

    /**
     * Parses the <textures> block. 
     * @param {textures block element} texturesNode
     */
    parseTextures(texturesNode) {
        var children = texturesNode.children;

        this.textures = [];
        var numTextures = 0;

        for(var i = 0; i < children.length; i++){
            if(children[i].nodeName != "texture") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }

            var textureID = this.reader.getString(children[i], 'id');
            if(textureID == null)
                return "no ID defined for texture";
            
            if(this.textures[textureID] != null)
                return "ID must be unique for each texture (conflict: ID = " + textureID + ")";
            
            var textureFile = this.reader.getString(children[i], 'file');
            if(textureFile == null)
                return "no file defined for texture";

            var newTexture = new CGFtexture(this.scene, textureFile);
            newTexture.bind(0);

            this.textures[textureID] = newTexture;
            numTextures++;
        }

        if(numTextures == 0)
            return "no textures defined"

        //For each texture in textures block, check ID and file URL
        return null;
    }

    /**
     * Parses the <materials> node.
     * @param {materials block element} materialsNode
     */
    parseMaterials(materialsNode) {
        var children = materialsNode.children;

        var grandChildren = [];
        var numMaterials = 0;

        // Any number of materials.
        for (var i = 0; i < children.length; i++) {

            if (children[i].nodeName != "material") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }

            // Get id of the current material.
            var materialID = this.reader.getString(children[i], 'id');
            if (materialID == null)
                return "no ID defined for material";

            // Checks for repeated IDs.
            if (this.appearances[materialID] != null)
                return "ID must be unique for each light (conflict: ID = " + materialID + ")";

            var appearance = new CGFappearance(this.scene);

            var shininess = this.reader.getFloat(children[i], 'shininess');
            if(shininess == null)
                return "no shininess defined for material (ID = " + materialID + ")";
            
            appearance.setShininess(shininess);

            grandChildren = children[i].children;

            if(grandChildren[0].nodeName != "emission") {
                return "first tag in material has to be emission (ID = " + materialID + ")";
            }
            var r = this.reader.getFloat(grandChildren[0], 'r');
            var g = this.reader.getFloat(grandChildren[0], 'g');
            var b = this.reader.getFloat(grandChildren[0], 'b');
            var a = this.reader.getFloat(grandChildren[0], 'a');

            if(r == null || g == null || b == null || a == null)
                return "r, g, b & a need to be defined in the grandChildren for material with ID = " + materialID;

            appearance.setEmission(r, g, b, a);

            if(grandChildren[1].nodeName != "ambient") {
                return "second tag in material has to be ambient (ID = " + materialID + ")";
            }
            r = this.reader.getFloat(grandChildren[1], 'r');
            g = this.reader.getFloat(grandChildren[1], 'g');
            b = this.reader.getFloat(grandChildren[1], 'b');
            a = this.reader.getFloat(grandChildren[1], 'a');

            if(r == null || g == null || b == null || a == null)
                return "r, g, b & a need to be defined in the grandChildren for material with ID = " + materialID;

            appearance.setAmbient(r, g, b, a);

            if(grandChildren[2].nodeName != "diffuse") {
                return "third tag in material has to be diffuse (ID = " + materialID + ")";
            }
            r = this.reader.getFloat(grandChildren[2], 'r');
            g = this.reader.getFloat(grandChildren[2], 'g');
            b = this.reader.getFloat(grandChildren[2], 'b');
            a = this.reader.getFloat(grandChildren[2], 'a');

            if(r == null || g == null || b == null || a == null)
                return "r, g, b & a need to be defined in the grandChildren for material with ID = " + materialID;

            appearance.setDiffuse(r, g,  b, a);
            
            if(grandChildren[3].nodeName != "specular") {
                return "fourth tag in material has to be specular (ID = " + materialID + ")";
            }
            r = this.reader.getFloat(grandChildren[3], 'r');
            g = this.reader.getFloat(grandChildren[3], 'g');
            b = this.reader.getFloat(grandChildren[3], 'b');
            a = this.reader.getFloat(grandChildren[3], 'a');

            if(r == null || g == null || b == null || a == null)
                return "r, g, b & a need to be defined in the grandChildren for material with ID = " + materialID;

            appearance.setSpecular(r, g, b, a);
            this.appearances[materialID] = appearance;
            
            numMaterials++;
        }

        if(numMaterials == 0)
            return "no materials defined";
        
        this.log("Parsed materials");
        return null;
    }

    /**
     * Parses the <transformations> block.
     * @param {transformations block element} transformationsNode
     */
    parseTransformations(transformationsNode) {
        var children = transformationsNode.children;

        this.transformations = [];

        var grandChildren = [];

        // Any number of transformations.
        for (var i = 0; i < children.length; i++) {

            if (children[i].nodeName != "transformation") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }

            // Get id of the current transformation.
            var transformationID = this.reader.getString(children[i], 'id');
            if (transformationID == null)
                return "no ID defined for transformation";

            // Checks for repeated IDs.
            if (this.transformations[transformationID] != null)
                return "ID must be unique for each transformation (conflict: ID = " + transformationID + ")";

            grandChildren = children[i].children;
            // Specifications for the current transformation.

            var transfMatrix = mat4.create();

            for (var j = 0; j < grandChildren.length; j++) {
                switch (grandChildren[j].nodeName) {
                    case 'translate':
                        var coordinates = this.parseCoordinates3D(grandChildren[j], "translate transformation for ID " + transformationID);
                        if (!Array.isArray(coordinates))
                            return coordinates;

                        transfMatrix = mat4.translate(transfMatrix, transfMatrix, coordinates);
                        break;
                    case 'scale':
                        let x = this.reader.getFloat(grandChildren[j], "x");
                        if(! (x != null && !isNaN(x)))
                            return "unable to parse x axis of the scaling";
                        let y = this.reader.getFloat(grandChildren[j], "y");
                        if(! (y != null && !isNaN(y)))
                            return "unable to parse y axis of the scaling";
                        let z = this.reader.getFloat(grandChildren[j], "z");
                        if(! (z != null && !isNaN(z)))
                            return "unable to parse z axis of the scaling";
                        transfMatrix = mat4.scale(transfMatrix, transfMatrix, [x, y, z]);
                        break;
                    case 'rotate':
                        // angle
                        let angle = this.reader.getFloat(grandChildren[j], "angle");
                        if(! (angle != null && !isNaN(angle)))
                            return "unable to parse angle of the rotation";
                        let axis = this.reader.getString(grandChildren[j], "axis");
                        if (axis == null || ['x', 'y', 'z'].indexOf(axis) == -1)
                            return "unable to parse angle of the rotation";
                        transfMatrix = mat4.rotate(transfMatrix, transfMatrix, angle * DEGREE_TO_RAD, [axis == 'x' ? 1 : 0, axis == 'y' ? 1 : 0, axis == 'z' ? 1 : 0]);
                        break;
                }
            }
            this.transformations[transformationID] = transfMatrix;
        }

        this.log("Parsed transformations");
        return null;
    }

    /**
     * Parses the <primitives> block.
     * @param {primitives block element} primitivesNode
     */
    parsePrimitives(primitivesNode) {
        var children = primitivesNode.children;

        this.primitives = [];

        var grandChildren = [];

        // Any number of primitives.
        for (var i = 0; i < children.length; i++) {

            if (children[i].nodeName != "primitive") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }

            // Get id of the current primitive.
            var primitiveId = this.reader.getString(children[i], 'id');
            if (primitiveId == null)
                return "no ID defined for texture";

            // Checks for repeated IDs.
            if (this.primitives[primitiveId] != null)
                return "ID must be unique for each primitive (conflict: ID = " + primitiveId + ")";

            grandChildren = children[i].children;

            // Validate the primitive type
            if (grandChildren.length != 1 ||
                (grandChildren[0].nodeName != 'rectangle' && grandChildren[0].nodeName != 'triangle' &&
                    grandChildren[0].nodeName != 'cylinder' && grandChildren[0].nodeName != 'sphere' &&
                    grandChildren[0].nodeName != 'torus' && grandChildren[0].nodeName != 'patch' )) {
                return "There must be exactly 1 primitive type (rectangle, triangle, cylinder, sphere, torus or patch)"
            }

            // Specifications for the current primitive.
            var primitiveType = grandChildren[0].nodeName;

            // Retrieves the primitive coordinates.
            if (primitiveType == 'rectangle') {
                // x1
                var x1 = this.reader.getFloat(grandChildren[0], 'x1');
                if (!(x1 != null && !isNaN(x1)))
                    return "unable to parse x1 of the primitive coordinates for ID = " + primitiveId;

                // y1
                var y1 = this.reader.getFloat(grandChildren[0], 'y1');
                if (!(y1 != null && !isNaN(y1)))
                    return "unable to parse y1 of the primitive coordinates for ID = " + primitiveId;

                // x2
                var x2 = this.reader.getFloat(grandChildren[0], 'x2');
                if (!(x2 != null && !isNaN(x2) && x2 > x1))
                    return "unable to parse x2 of the primitive coordinates for ID = " + primitiveId;

                // y2
                var y2 = this.reader.getFloat(grandChildren[0], 'y2');
                if (!(y2 != null && !isNaN(y2) && y2 > y1))
                    return "unable to parse y2 of the primitive coordinates for ID = " + primitiveId;

                var rect = new MyRectangle(this.scene, primitiveId, x1, x2, y1, y2);

                this.primitives[primitiveId] = rect;
            }
            else if (primitiveType == 'cylinder') {
                var base = this.reader.getFloat(grandChildren[0], 'base');
                if(! (base != null && !isNaN(base)))
                    return "unable to parse base of the primitive base radius for ID = " + primitiveId;

                var top = this.reader.getFloat(grandChildren[0], 'top');
                if(! (top != null && !isNaN(top)))
                    return "unable to parse top of the primitive top radius for ID = " + primitiveId;
                
                var height = this.reader.getFloat(grandChildren[0], 'height');
                if(! (height != null && !isNaN(height)))
                    return "unable to parse height of the primitive height for ID = " + primitiveId;

                var slices = this.reader.getInteger(grandChildren[0], 'slices');
                if(! (slices != null && !isNaN(slices)))
                    return "unable to parse slices of the primitive slices for ID = " + primitiveId;

                var stacks = this.reader.getInteger(grandChildren[0], 'stacks');
                if(! (stacks != null && !isNaN(stacks)))
                    return "unable to parse stacks of the primitive stacks for ID = " + primitiveId;
                
                var cylinder = new MyCylinder(this.scene, primitiveId, base, top, height, slices, stacks);

                this.primitives[primitiveId] = cylinder;
            }
            else if (primitiveType == 'sphere') {
                var radius = this.reader.getFloat(grandChildren[0], 'radius');
                if(! (radius != null && !isNaN(radius)))
                    return "unable to parse radius of the primitive for ID = " + primitiveId;
                var slices = this.reader.getInteger(grandChildren[0], 'slices');
                if(! (slices != null && !isNaN(slices)))
                    return "unable to parse slices of the primitive slices for ID = " + primitiveId;
                var stacks = this.reader.getInteger(grandChildren[0], 'stacks');
                if(! (stacks != null && !isNaN(stacks)))
                    return "unable to parse stacks of the primitive stacks for ID = " + primitiveId;
                
                var sphere = new MySphere(this.scene, primitiveId, radius, slices, stacks);

                this.primitives[primitiveId] = sphere;
            }
            else if (primitiveType == 'torus') {
                var outer = this.reader.getFloat(grandChildren[0], 'outer');
                if(! (outer != null && !isNaN(outer)))
                    return "unable to parse outer radius of the primitive for ID = " + primitiveId;
                var inner = this.reader.getFloat(grandChildren[0], 'inner');
                if(! (inner != null && !isNaN(inner)))
                    return "unable to parse inner radius of the primitive for ID = " + primitiveId;
                var slices = this.reader.getInteger(grandChildren[0], 'slices');
                if(! (slices != null && !isNaN(slices)))
                    return "unable to parse slices of the primitive slices for ID = " + primitiveId;
                var loops = this.reader.getInteger(grandChildren[0], 'loops');
                if(! (loops != null && !isNaN(loops)))
                    return "unable to parse loops of the primitive for ID = " + primitiveId;
                
                var torus = new MyTorus(this.scene, primitiveId, inner, outer, slices, loops);

                this.primitives[primitiveId] = torus;
            }
            else if (primitiveType == 'triangle') {
                var x1 = this.reader.getFloat(grandChildren[0], 'x1');
                if(! (x1 != null && !isNaN(x1)))
                    return "unable to parse x1 of the primitive for ID = " + primitiveId;
                var y1 = this.reader.getFloat(grandChildren[0], 'y1');
                if(! (y1 != null && !isNaN(y1)))
                    return "unable to parse y1 of the primitive for ID = " + primitiveId;
                var z1 = this.reader.getFloat(grandChildren[0], 'z1');
                if(! (z1 != null && !isNaN(z1)))
                    return "unable to parse z1 of the primitive for ID = " + primitiveId;
                var x2 = this.reader.getFloat(grandChildren[0], 'x2');
                if(! (x2 != null && !isNaN(x2)))
                    return "unable to parse x2 of the primitive for ID = " + primitiveId;
                var y2 = this.reader.getFloat(grandChildren[0], 'y2');
                if(! (y2 != null && !isNaN(y2)))
                    return "unable to parse y2 of the primitive for ID = " + primitiveId;
                var z2 = this.reader.getFloat(grandChildren[0], 'z2');
                if(! (z2 != null && !isNaN(z2)))
                    return "unable to parse z2 of the primitive for ID = " + primitiveId;
                var x3 = this.reader.getFloat(grandChildren[0], 'x3');
                if(! (x3 != null && !isNaN(x3)))
                    return "unable to parse x3 of the primitive for ID = " + primitiveId;
                var y3 = this.reader.getFloat(grandChildren[0], 'y3');
                if(! (y3 != null && !isNaN(y3)))
                    return "unable to parse y3 of the primitive for ID = " + primitiveId;
                var z3 = this.reader.getFloat(grandChildren[0], 'z3');
                if(! (z3 != null && !isNaN(z3)))
                    return "unable to parse z3 of the primitive for ID = " + primitiveId;

                var triangle = new MyTriangle(this.scene, primitiveId, x1, y1, z1, x2, y2, z2, x3, y3, z3);
                this.primitives[primitiveId] = triangle;
            }
            else if(primitiveType == 'patch') {
                var degree_u = this.reader.getInteger(grandChildren[0], 'degree_u');
                if(! (degree_u != null && !isNaN(degree_u)))
                    return "unable to parse degree_u of the primitive for ID = " + primitiveId;

                var parts_u = this.reader.getInteger(grandChildren[0], 'parts_u');
                if(! (parts_u != null && !isNaN(parts_u)))
                    return "unable to parse parts_u of the primitive for ID = " + primitiveId;
                
                var degree_v = this.reader.getInteger(grandChildren[0], 'degree_v');
                if(! (degree_v != null && !isNaN(degree_v)))
                    return "unable to parse degree_v of the primitive for ID = " + primitiveId;

                var parts_v = this.reader.getInteger(grandChildren[0], 'parts_v');
                if(! (parts_v != null && !isNaN(parts_v)))
                    return "unable to parse parts_v of the primitive for ID = " + primitiveId;

                var controlPoints = [];
                var controlPointsNode = grandChildren[0].children;

                if(controlPointsNode.length != ((degree_u + 1) * (degree_v + 1)))
                    return "wrong number of control points in primitive with ID = " + primitiveId;
                
                for(let u = 0; u <= degree_u; u++) {
                    let controlPoints_u = [];

                    for (let v = 0; v <= degree_v; v++) {
                        let index = u * (degree_v + 1) + v;

                        var x = this.reader.getFloat(controlPointsNode[index], 'x');
                        if(! (x != null && !isNaN(x)))
                            return "unable to parse x of the primitive for ID = " + primitiveId;
                        var y = this.reader.getFloat(controlPointsNode[index], 'y');
                        if(! (y != null && !isNaN(y)))
                            return "unable to parse y of the primitive for ID = " + primitiveId;
                        var z = this.reader.getFloat(controlPointsNode[index], 'z');
                        if(! (z != null && !isNaN(z)))
                            return "unable to parse z of the primitive for ID = " + primitiveId;

                        controlPoints_u.push([x, y, z, 1]);
                    }

                    controlPoints.push(controlPoints_u);
                }

                console.log(controlPoints);

                var patch = new MyPatch(this.scene, primitiveId, degree_u, parts_u, degree_v, parts_v, controlPoints);
                this.primitives[primitiveId] = patch;
            }
            else {
                console.warn("To do: Parse other primitives.");
            }
        }

        this.log("Parsed primitives");
        return null;
    }

    /**
     * Parses a rotation node.
     * @param {rotation node} node
     * @param {string} animation
     * @returns {object} rotation
     */
    parseRotation(node, animationID){
        var axis = this.reader.getString(node, 'axis');
        if(axis == null)
            this.onXMLError("unable to parse axis of the rotation for ID = " + animationID);

        var angle = this.reader.getFloat(node, 'angle');
        if(! (angle != null && !isNaN(angle)))
            return "unable to parse angle of the rotation for ID = " + animationID;

        return [axis, angle * DEGREE_TO_RAD];
    }

    /**
     * Parses the animations node.
     * @param {animations node} animationsNode
     * @returns {null}
     */
    parseAnimations(animationsNode) {
        this.animations = [];

        var children = animationsNode.children;

        for (var i = 0; i < children.length; i++) {
            if (children[i].nodeName != "keyframeanim") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }

            var animationId = this.reader.getString(children[i], 'id');
            if (animationId == null)
                return "no ID defined for animation";

            if (this.animations[animationId] != null)
                return "ID must be unique for each animation (conflict: ID = " + animationId + ")";

            var grandChildren = children[i].children;

            var keyframes = [];
            for(var k = 0; k < grandChildren.length; k++) {
                var instant = this.reader.getFloat(grandChildren[k], 'instant');
                if(! (instant != null && !isNaN(instant)))
                    return "unable to parse instant of the animation for ID = " + animationId;

                var rotation_x, rotation_y, rotation_z, scale;
                var grandgrandChildren = grandChildren[k].children;

                if(grandgrandChildren.length != 5)
                    return "wrong number of transformations in animation with ID = " + animationId;

                if(grandgrandChildren[0].nodeName != "translation")
                    return "translate must be the first transformation of the animation with ID = " + animationId;

                var x = this.reader.getFloat(grandgrandChildren[0], 'x');
                if(! (x != null && !isNaN(x)))
                    return "unable to parse x of the animation for ID = " + animationId;
                var y = this.reader.getFloat(grandgrandChildren[0], 'y');
                if(! (y != null && !isNaN(y)))
                    return "unable to parse y of the animation for ID = " + animationId;
                var z = this.reader.getFloat(grandgrandChildren[0], 'z');
                if(! (z != null && !isNaN(z)))
                    return "unable to parse z of the animation for ID = " + animationId;

                var translation = [x, y, z];

                if(grandgrandChildren[1].nodeName != "rotation" || grandgrandChildren[2].nodeName != "rotation" || grandgrandChildren[3].nodeName != "rotation")
                    return "rotations must be the second, third and fourth transformations of the animation with ID = " + animationId;

                var rotation_z = this.parseRotation(grandgrandChildren[1], animationId);
                if(rotation_z[0] != 'z')
                    return "rotation z must be the second transformation of the animation with ID = " + animationId;
                rotation_z = rotation_z[1];

                var rotation_y = this.parseRotation(grandgrandChildren[2], animationId);
                if(rotation_y[0] != 'y')
                    return "rotation y must be the third transformation of the animation with ID = " + animationId;
                rotation_y = rotation_y[1];

                var rotation_x = this.parseRotation(grandgrandChildren[3], animationId);
                if(rotation_x[0] != 'x')
                    return "rotation x must be the fourth transformation of the animation with ID = " + animationId;
                rotation_x = rotation_x[1];

                if(grandgrandChildren[4].nodeName != "scale")
                    return "scale must be the fifth transformation of the animation with ID = " + animationId;

                var sx = this.reader.getFloat(grandgrandChildren[4], 'sx');
                if(! (sx != null && !isNaN(sx)))
                    return "unable to parse sx of the animation for ID = " + animationId;

                var sy = this.reader.getFloat(grandgrandChildren[4], 'sy');
                if(! (sy != null && !isNaN(sy)))
                    return "unable to parse sy of the animation for ID = " + animationId;
                
                var sz = this.reader.getFloat(grandgrandChildren[4], 'sz');
                if(! (sz != null && !isNaN(sz)))
                    return "unable to parse sz of the animation for ID = " + animationId;

                var scale = [sx, sy, sz];

                keyframes.push(new MyKeyframe(instant, translation, rotation_x, rotation_y, rotation_z, scale));
            }

            console.log(keyframes);

            this.animations[animationId] = new MyKeyframeAnimation(this.scene, animationId, keyframes);
        }
    }

    /**
   * Parses the <components> block.
   * @param {components block element} componentsNode
   */
    parseComponents(componentsNode) {
        var children = componentsNode.children;

        let components = [];

        var grandChildren = [];
        var grandgrandChildren = [];
        var nodeNames = [];

        // Any number of components.
        for (var i = 0; i < children.length; i++) {
            if (children[i].nodeName != "component") {
                this.onXMLMinorError("unknown tag <" + children[i].nodeName + ">");
                continue;
            }

            // Get id of the current component.
            var componentID = this.reader.getString(children[i], 'id');

            if (componentID == null)
                return "no ID defined for componentID";

            // Checks for repeated IDs.
            if (components[componentID] != null)
                return "ID must be unique for each component (conflict: ID = " + componentID + ")";

            grandChildren = children[i].children;

            nodeNames = [];
            for (var j = 0; j < grandChildren.length; j++) {
                nodeNames.push(grandChildren[j].nodeName);
            }

            var transformationIndex = nodeNames.indexOf("transformation");
            var materialsIndex = nodeNames.indexOf("materials");
            var textureIndex = nodeNames.indexOf("texture");
            var childrenIndex = nodeNames.indexOf("children");
            var animationIndex = nodeNames.indexOf("animation");
            var highlightedIndex = nodeNames.indexOf("highlighted");

            // Transformations

            if (transformationIndex == -1) {
                this.onXMLError("A component must have at least one tranformation");
                continue;
            }

            grandgrandChildren = grandChildren[transformationIndex].children;

            let transfMatrix = mat4.create();
            
            for (let k = 0; k < grandgrandChildren.length; k++) {
                switch (grandgrandChildren[k].nodeName) {
                    case 'translate':
                        let coordinates = this.parseCoordinates3D(grandgrandChildren[k], "Translation");
                        if (!Array.isArray(coordinates))
                            return coordinates;

                        transfMatrix = mat4.translate(transfMatrix, transfMatrix, coordinates);
                        break;
                    case 'scale':
                        let x = this.reader.getFloat(grandgrandChildren[k], "x");
                        if(! (x != null && !isNaN(x)))
                            return "unable to parse x axis of the scaling";
                        let y = this.reader.getFloat(grandgrandChildren[k], "y");
                        if(! (y != null && !isNaN(y)))
                            return "unable to parse y axis of the scaling";
                        let z = this.reader.getFloat(grandgrandChildren[k], "z");
                        if(! (z != null && !isNaN(z)))
                            return "unable to parse z axis of the scaling";
                        transfMatrix = mat4.scale(transfMatrix, transfMatrix, [x, y, z]);
                        break;
                    case 'rotate':
                        // angle
                        let angle = this.reader.getFloat(grandgrandChildren[k], "angle");
                        if(! (angle != null && !isNaN(angle)))
                            return "unable to parse angle of the rotation";
                        let axis = this.reader.getString(grandgrandChildren[k], "axis");
                        if (axis == null || ['x', 'y', 'z'].indexOf(axis) == -1)
                            return "unable to parse angle of the rotation";
                        transfMatrix = mat4.rotate(transfMatrix, transfMatrix, angle * DEGREE_TO_RAD, [axis == 'x' ? 1 : 0, axis == 'y' ? 1 : 0, axis == 'z' ? 1 : 0]);
                        break;
                    case 'transformationref':
                        if(grandgrandChildren.length > 1){
                            return "if component has one transformationref, it can't have other transformations (ID = " + componentID + ")";
                        }
                        let transformationref = this.reader.getString(grandgrandChildren[k], "id");
                        if (transformationref == null) {
                            this.onXMLError("transformationref " + k + " on component " + componentID + " must have an ID");
                            continue;
                        }
                        transfMatrix = mat4.mul(transfMatrix, transfMatrix, this.transformations[transformationref]);
                        break;
                }
            }

            // Materials
            if (materialsIndex == -1){
                this.onXMLError("component missing material (ID = " + componentID + ")");
                continue;
            }

            let materials = [];
            grandgrandChildren = grandChildren[materialsIndex].children;

            for (var k = 0; k < grandgrandChildren.length; k++){
                if(grandgrandChildren[k].nodeName != "material"){
                    this.onXMLError("unkown tag <" + grandgrandChildren[i].nodeName + ">");
                    continue;
                }

                var materialID = this.reader.getString(grandgrandChildren[k], 'id');
                if(materialID == null){
                    this.onXMLError("material needs to have ID on component with ID = " + componentID);
                    continue;
                }
                
                if(this.appearances[materialID] == null && materialID != "inherit"){
                    this.onXMLError("material needs to have been defined before on component with ID = " + componentID);
                    continue;
                }
                
                materials.push(materialID);
            }

            // Texture
            if (textureIndex == -1){
                this.onXMLError("component missing texture (ID = " + componentID + ")");
                continue;
            }

            var textureID = this.reader.getString(grandChildren[textureIndex], 'id');
            let lengthS = 1;
            let lengthT = 1;
            if(textureID == null){
                this.onXMLError("no ID from texture in component (ID = " + componentID + ")");
                continue;
            }
            else if(this.textures[textureID] == null && textureID != "none" && textureID != "inherit"){
                this.onXMLError("no texture defined with ID = " + textureID);
            }
            else{
                var length_s = this.reader.getFloat(grandChildren[textureIndex], "length_s", false);
                var length_t = this.reader.getFloat(grandChildren[textureIndex], "length_t", false);
                if(length_s != null && length_t != null){
                    if(textureID == "inherit") {
                        this.onXMLMinorError("there shouldn't be a length_s and/or length_t on inherited texture in component with ID = " + componentID);
                        lengthS = length_s;
                        lengthT = length_t;
                    }
                    else if(textureID == "none"){
                        this.onXMLMinorError("there shouldn't be a length_s and/or length_t on 'none' texture in component with ID = " + componentID);
                    }
                    else{
                        lengthS = length_s;
                        lengthT = length_t;
                    }
                }
                else{
                    if(textureID != "none" && textureID != "inherit"){
                        if(length_s == null){
                            this.onXMLError("no length_s from texture with ID = " + textureID + " in componente with ID = " + componentID);
                            lengthS = 1;
                        }
                        else lengthS = length_s;
                        

                        if(length_t == null){
                            this.onXMLError("no length_t from texture with ID = " + textureID + " in componente with ID = " + componentID);
                            lengthT = 1;
                        }
                        else lengthT = length_t;
                    }
                }
            }
            let textureInfo = new MyTextureInfo(textureID, lengthS, lengthT);

            // Children

            if (childrenIndex == -1) {
                this.onXMLError("A component must have children");
                continue;
            }

            grandgrandChildren = grandChildren[childrenIndex].children;

            let componentPrimitives = [];
            let componentComponents = [];

            for (let k = 0; k < grandgrandChildren.length; k++) {
                switch (grandgrandChildren[k].nodeName) {
                    case 'primitiveref':
                        let primitiveref = this.reader.getString(grandgrandChildren[k], "id");
                        if (primitiveref == null) {
                            this.onXMLError("primitiveref " + k + " on component " + componentID + " must have an ID");
                            continue;
                        }
                        componentPrimitives.push(primitiveref);
                        break;
                    case 'componentref':
                        let componentref = this.reader.getString(grandgrandChildren[k], "id");
                        if (componentref == null) {
                            this.onXMLError("componentref " + k + " on component " + componentID + " must have an ID");
                            continue;
                        }
                        componentComponents.push(componentref);
                        break;
                    default:
                        break;
                }
            }

            let highlightInfo = null;
            if(highlightedIndex != -1){
                var r = this.reader.getFloat(grandChildren[highlightedIndex], 'r');
                if (!(r != null && !isNaN(r) && r >= 0 && r <= 1))
                    return "unable to parse r in component with ID = " + componentID;

                var g = this.reader.getFloat(grandChildren[highlightedIndex], 'g');
                if (!(g != null && !isNaN(g) && g >= 0 && g <= 1))
                    return "unable to parse g in component with ID = " + componentID;

                var b = this.reader.getFloat(grandChildren[highlightedIndex], 'b');
                if (!(b != null && !isNaN(b) && b >= 0 && b <= 1))
                    return "unable to parse b in component with ID = " + componentID;

                var scale_h = this.reader.getFloat(grandChildren[highlightedIndex], 'scale_h');
                if (!(scale_h != null && !isNaN(scale_h)))
                    return "unable to parse scale_h in component with ID = " + componentID;

                highlightInfo = new MyHighlightInfo(true, [r, g, b], scale_h);
            }

            let animation = null;
            if(animationIndex != -1){
                var animationID = this.reader.getString(grandChildren[animationIndex], 'id');
                if(animationID == null){
                    this.onXMLError("no ID from animation in component (ID = " + componentID + ")");
                    continue;
                }
                else if(this.animations[animationID] == null){
                    this.onXMLError("no animation defined with ID = " + animationID);
                }
                else animation = animationID;
            }

            components[componentID] = new MyComponent(
                this,
                componentID,
                transfMatrix,
                materials,
                animation,
                textureInfo,
                highlightInfo,
                componentPrimitives,
                componentComponents
            );

           }

        this.components = components;

        this.log("Parsed components");
    }


    /**
     * Parse the coordinates from a node with ID = id
     * @param {block element} node
     * @param {message to be displayed in case of error} messageError
     */
    parseCoordinates3D(node, messageError) {
        var position = [];

        // x
        var x = this.reader.getFloat(node, 'x');
        if (!(x != null && !isNaN(x)))
            return "unable to parse x-coordinate of the " + messageError;

        // y
        var y = this.reader.getFloat(node, 'y');
        if (!(y != null && !isNaN(y)))
            return "unable to parse y-coordinate of the " + messageError;

        // z
        var z = this.reader.getFloat(node, 'z');
        if (!(z != null && !isNaN(z)))
            return "unable to parse z-coordinate of the " + messageError;

        position.push(...[x, y, z]);

        return position;
    }

    /**
     * Parse the coordinates from a node with ID = id
     * @param {block element} node
     * @param {message to be displayed in case of error} messageError
     */
    parseCoordinates4D(node, messageError) {
        var position = [];

        //Get x, y, z
        position = this.parseCoordinates3D(node, messageError);

        if (!Array.isArray(position))
            return position;


        // w
        var w = this.reader.getFloat(node, 'w');
        if (!(w != null && !isNaN(w)))
            return "unable to parse w-coordinate of the " + messageError;

        position.push(w);

        return position;
    }

    /**
     * Parse the color components from a node
     * @param {block element} node
     * @param {message to be displayed in case of error} messageError
     */
    parseColor(node, messageError) {
        var color = [];

        // R
        var r = this.reader.getFloat(node, 'r');
        if (!(r != null && !isNaN(r) && r >= 0 && r <= 1))
            return "unable to parse R component of the " + messageError;

        // G
        var g = this.reader.getFloat(node, 'g');
        if (!(g != null && !isNaN(g) && g >= 0 && g <= 1))
            return "unable to parse G component of the " + messageError;

        // B
        var b = this.reader.getFloat(node, 'b');
        if (!(b != null && !isNaN(b) && b >= 0 && b <= 1))
            return "unable to parse B component of the " + messageError;

        // A
        var a = this.reader.getFloat(node, 'a');
        if (!(a != null && !isNaN(a) && a >= 0 && a <= 1))
            return "unable to parse A component of the " + messageError;

        color.push(...[r, g, b, a]);

        return color;
    }

    /*
     * Callback to be executed on any read error, showing an error on the console.
     * @param {string} message
     */
    onXMLError(message) {
        console.error("XML Loading Error: " + message);
        this.loadedOk = false;
    }

    /**
     * Callback to be executed on any minor error, showing a warning on the console.
     * @param {string} message
     */
    onXMLMinorError(message) {
        console.warn("Warning: " + message);
    }

    /**
     * Callback to be executed on any message.
     * @param {string} message
     */
    log(message) {
        console.log("   " + message);
    }

    /**
     * Increment the scene's material index
     */
    incrementMaterialIndex(){
        this.materialIndex++;
    }

    /**
     * Displays the scene, processing each node, starting in the root node.
     */
    displayScene() {
        this.components[this.idRoot].display();
    }
}