const express = require("express");
const app = express();
const bodyParser = require("body-parser");

const PORT = 3000;

const api = require("./routes");

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(express.json());

app.use("/api", api);

app.listen(PORT, () => {
  console.log(`Ebirr test app listening on port ${PORT}`);
});
