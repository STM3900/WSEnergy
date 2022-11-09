// Import du dotenv
require("dotenv").config();

// Imports d'express JS
const express = require("express");
const app = express();
const port = 3000;

const axios = require("axios");
const cors = require("cors");

app.use(cors());

// Fonctions

// Faire une moyenne
const average = (array) => array.reduce((a, b) => a + b) / array.length;

// Fonction pour convertir les reponses API en objets JSON exploitables
const serializeAverageTemperature = (response) => {
  const tab = [];

  for (let i = 0; i < response.data.list.length; i++) {
    tab.push(response.data.list[i].main.temp);
  }

  const responseObj = {
    average_temperature: average(tab).toFixed(2),
  };

  return responseObj;
};

const serializeInstantConsumption = (response) => {
  const responseObj = {
    actual_consumption: response.data.short_term[0].values.pop().value,
  };

  return responseObj;
};

const serializeInstantProduction = (response) => {
  const responseObj = {};
  const productionTab = [];

  for (
    let i = 0;
    i < response.data.generation_mix_15min_time_scale.length;
    i++
  ) {
    let actualData = response.data.generation_mix_15min_time_scale[i];

    if (actualData.production_subtype == "TOTAL") {
      productionTab.push({
        production_type:
          response.data.generation_mix_15min_time_scale[i].production_type,
        value:
          response.data.generation_mix_15min_time_scale[i].values.pop().value,
      });
    }
  }

  const totalProduction = productionTab
    .map((item) => item.value)
    .reduce((prev, curr) => prev + curr, 0);

  responseObj.total_production = totalProduction;
  responseObj.production_per_type = productionTab;

  return responseObj;
};

// Token pour l'api RTE qui sera renseigné lors de la fonction getToken()
let token = "";

// Génère le token
const getToken = () => {
  const authURL = "https://digital.iservices.rte-france.com/token/oauth/";
  const authTOKEN = process.env.RTE_ACCOUNT_TOKEN;

  axios
    .get(authURL, {
      headers: {
        Authorization: "Basic " + authTOKEN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
    .then((response) => {
      token = response.data.access_token;
      initializeRequests();
    })
    .catch((error) => {
      res.send(error);
      console.error(error);
    });
};

getToken();

// Initialisation des url des requetes API externes
const urlTemperature = `http://api.openweathermap.org/data/2.5/group?id=3030300,6455259,6441375,6454573,3024635,6453974,4923747,6454924&units=metric&appid=${process.env.OPEN_WEATHER_TOKEN}`;
const urlConsumption =
  "https://digital.iservices.rte-france.com/open_api/consumption/v1/short_term?type=REALISED,ID";
const urlProduction =
  "https://digital.iservices.rte-france.com/open_api/actual_generation/v1/generation_mix_15min_time_scale";

// Initialisation des requetes API externes
let requestTemperature = "";
let requestConsumption = "";
let requestProduction = "";

const initializeRequests = () => {
  requestTemperature = axios.get(urlTemperature);
  requestConsumption = axios.get(urlConsumption, {
    headers: {
      Authorization: "Bearer " + token,
    },
  });

  requestProduction = axios.get(urlProduction, {
    headers: {
      Authorization: "Bearer " + token,
    },
  });
};

// Routes API
app.get("/", (req, res) => {
  res.send("Welcome to WSEnergy API");
});

// Pour obtenir toutes les infos d'un seul coup
app.get("/getall", (req, res) => {
  axios
    .all([requestTemperature, requestConsumption, requestProduction])
    .then(
      axios.spread((...responses) => {
        const responseTemperature = serializeAverageTemperature(responses[0]);
        const responseConsumption = serializeInstantConsumption(responses[1]);
        const responseProduction = serializeInstantProduction(responses[2]);

        const finalObject = {
          ...responseTemperature,
          ...responseConsumption,
          ...responseProduction,
        };

        res.send(finalObject);
        console.log(finalObject);
      })
    )
    .catch((errors) => {
      res.send(errors);
      console.error(errors);
    });
});

// Renvoie la temperature moyenne de France (on fait la moyenne de temperature de plusieurs villes du pays)
app.get("/average_temperature", (req, res) => {
  requestTemperature
    .then((response) => {
      const responseTemperature = serializeAverageTemperature(response);

      res.send(responseTemperature);
      console.log(responseTemperature);
    })
    .catch((error) => {
      res.send(error);
      console.error(error);
    });
});

// Renvoie la consommation d'éléctricité actuelle
app.get("/consumption", (req, res) => {
  requestConsumption
    .then((response) => {
      const responseConsumption = serializeInstantConsumption(response);

      res.send(responseConsumption);
      console.log(responseConsumption);
    })
    .catch((error) => {
      res.send(error);
      console.error(error);
    });
});

// Renvoie la production totale d'éléctricité à l'instanté, et la production par type
app.get("/production", (req, res) => {
  requestProduction
    .then((response) => {
      const responseProduction = serializeInstantProduction(response);

      res.send(responseProduction);
      console.log(responseProduction);
    })
    .catch((error) => {
      res.send(error);
      console.error(error);
    });
});

// Lancement de l'API
app.listen(port, () => {
  console.log(`WSEnergy API écoute sur le port : ${port}`);
});
