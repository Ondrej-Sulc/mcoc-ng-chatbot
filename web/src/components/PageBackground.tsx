import React from 'react';
import { Starfield } from './Starfield';

const PageBackground = React.memo(function PageBackground() {
  return (
    <div className="hero-bg-top">
      <Starfield />
    </div>
  );
});

export default PageBackground;
