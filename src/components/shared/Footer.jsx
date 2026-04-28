import styles from "./Footer.module.css";

const imgBasePath = "https://bibliotecadigitaluplaph.hidalgo.gob.mx/img_banco/footer/";

const Footer = () => {
  return (
    <footer id="footer" className={styles.footer}>
      <div className={styles.footerRedes}>
        <a
          href="https://www.facebook.com/profile.php?id=100069229599131"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={`${imgBasePath}facebook.webp`} alt="Logo de Facebook" />
        </a>
        <a
          href="https://www.instagram.com/gobiernohidalgo/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={`${imgBasePath}instagram.webp`} alt="Logo de Instagram" />
        </a>
        <a
          href="https://www.youtube.com/@GobiernoHidalgoMx"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={`${imgBasePath}youtube.webp`} alt="Logo de YouTube" />
        </a>
        <a
          href="https://x.com/PlaneacionHgo"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={`${imgBasePath}x.webp`} alt="Logo de X" />
        </a>
      </div>

      {/* 
      <div className={styles.imageContainer}>
        <img src={`${imgBasePath}logo_footer.png`} alt="img_representativa" />
      </div> 
      */}

      <div className={styles.footerContacto}>
        <div className={styles.footerContactoTxt}>
          <div className={styles.footerContactoIco}>
            <img src={`${imgBasePath}telefono.webp`} alt="icono de un telefono" />
            <div>
              <p>
                <span>CONTACTO:</span>
              </p>
              <p>
                <span>Tel.: 771 717 6000 ext. 6410</span>
              </p>
            </div>
          </div>

          <p>
            <span>Coordinación General de Planeación y Proyectos</span>
          </p>
          <p>Dirección General de Desarrollo Regional y Metropolitano</p>
          {/* <p><span>Unidad de Planeación y Prospectiva</span></p> */}
          <p>cg.planeacion@hidalgo.gob.mx</p>

          <div className={styles.lineaFooter}></div>

          <p>Gobierno del Estado de Hidalgo</p>
          <p>
            <span>www.hidalgo.gob.mx</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
